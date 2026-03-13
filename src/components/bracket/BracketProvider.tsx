"use client";

import { createContext, useReducer, useMemo, useCallback, type ReactNode } from "react";
import type { TeamSeason, TournamentSite } from "@/types/team";
import type { GlobalLevers, MatchupOverrides } from "@/types/engine";
import { DEFAULT_GLOBAL_LEVERS } from "@/types/engine";
import { buildSiteMap } from "@/lib/engine/site-mapping";
import type {
  BracketState,
  BracketAction,
  SavedBracketData,
} from "@/types/bracket-ui";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import type { BracketMatchup, PlayInConfig } from "@/types/simulation";
import { isGameId } from "@/lib/bracket-utils";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface BracketContextValue {
  state: BracketState;
  dispatch: React.Dispatch<BracketAction>;
}

export const BracketContext = createContext<BracketContextValue | null>(null);

// ---------------------------------------------------------------------------
// Cascade invalidation helpers
// ---------------------------------------------------------------------------

/**
 * Build a lookup from gameId to all downstream gameIds that depend on it.
 * A game X is downstream of game Y if Y appears as teamASource or teamBSource of X.
 *
 * Recognizes FF-, R64-, R32-, S16-, E8-, F4- prefixed game IDs.
 */
function buildDownstreamMap(
  matchups: BracketMatchup[]
): Map<string, string[]> {
  const downstream = new Map<string, string[]>();

  for (const m of matchups) {
    if (isGameId(m.teamASource)) {
      const existing = downstream.get(m.teamASource) ?? [];
      existing.push(m.gameId);
      downstream.set(m.teamASource, existing);
    }
    if (isGameId(m.teamBSource)) {
      const existing = downstream.get(m.teamBSource) ?? [];
      existing.push(m.gameId);
      downstream.set(m.teamBSource, existing);
    }
  }

  return downstream;
}

/**
 * Cascade-clear downstream picks when a team is replaced.
 * If a game's winner changes and the old winner was picked in any downstream game,
 * those downstream picks must be cleared.
 */
function cascadeInvalidation(
  picks: Record<string, string>,
  gameId: string,
  oldWinnerId: string | undefined,
  downstreamMap: Map<string, string[]>
): Record<string, string> {
  if (!oldWinnerId) return picks;

  const newPicks = { ...picks };
  const toCheck = downstreamMap.get(gameId) ?? [];

  for (const downstreamGameId of toCheck) {
    if (newPicks[downstreamGameId] === oldWinnerId) {
      // Clear this pick and cascade further
      delete newPicks[downstreamGameId];
      // Continue cascading from this downstream game
      const furtherDown = cascadeInvalidation(
        newPicks,
        downstreamGameId,
        oldWinnerId,
        downstreamMap
      );
      Object.assign(newPicks, furtherDown);
    }
  }

  return newPicks;
}

// ---------------------------------------------------------------------------
// Simulation input hash (for staleness detection)
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic hash of the simulation-relevant inputs.
 * Used to detect whether simulation results are stale after user changes.
 *
 * Uses djb2 hash over a JSON serialization of picks + levers + overrides.
 */
export function computeInputHash(
  picks: Record<string, string>,
  globalLevers: GlobalLevers,
  matchupOverrides: Record<string, MatchupOverrides>
): string {
  const payload = JSON.stringify({ picks, globalLevers, matchupOverrides });
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Wraps a new state object with simulation staleness detection.
 * If a simulation has been run (simulationInputHash is set), recomputes
 * the current hash and compares to detect staleness.
 */
function withStalenessCheck(newState: BracketState): BracketState {
  if (newState.simulationInputHash === null) {
    return { ...newState, isSimulationStale: false };
  }
  const currentHash = computeInputHash(
    newState.picks,
    newState.globalLevers,
    newState.matchupOverrides
  );
  return {
    ...newState,
    isSimulationStale: currentHash !== newState.simulationInputHash,
  };
}

// ---------------------------------------------------------------------------
// Reducer factory
// ---------------------------------------------------------------------------

/**
 * Creates a bracket reducer that closes over the downstream map.
 *
 * The downstream map depends on play-in config (which determines whether
 * FF games exist in the matchup tree). By creating the reducer as a
 * closure, we avoid putting the map in state while still allowing it
 * to vary based on play-in config.
 */
function createBracketReducer(downstreamMap: Map<string, string[]>) {
  return function bracketReducer(
    state: BracketState,
    action: BracketAction
  ): BracketState {
    switch (action.type) {
      case "ADVANCE_TEAM": {
        const oldWinner = state.picks[action.gameId];
        let newPicks = { ...state.picks };

        // If the winner changed, cascade-invalidate downstream picks
        if (oldWinner && oldWinner !== action.teamId) {
          newPicks = cascadeInvalidation(
            newPicks,
            action.gameId,
            oldWinner,
            downstreamMap
          );
        }

        newPicks[action.gameId] = action.teamId;

        return withStalenessCheck({
          ...state,
          picks: newPicks,
          isDirty: true,
        });
      }

      case "RESET_PICK": {
        const oldWinner = state.picks[action.gameId];
        let newPicks = { ...state.picks };

        // Cascade-invalidate downstream picks that depended on this winner
        if (oldWinner) {
          newPicks = cascadeInvalidation(
            newPicks,
            action.gameId,
            oldWinner,
            downstreamMap
          );
        }

        delete newPicks[action.gameId];

        return withStalenessCheck({
          ...state,
          picks: newPicks,
          isDirty: true,
        });
      }

      case "SET_GLOBAL_LEVERS": {
        return withStalenessCheck({
          ...state,
          globalLevers: {
            ...state.globalLevers,
            ...action.levers,
          },
          isDirty: true,
        });
      }

      case "SET_MATCHUP_OVERRIDE": {
        return withStalenessCheck({
          ...state,
          matchupOverrides: {
            ...state.matchupOverrides,
            [action.gameId]: action.overrides,
          },
          isDirty: true,
        });
      }

      case "REMOVE_MATCHUP_OVERRIDE": {
        const newOverrides = { ...state.matchupOverrides };
        delete newOverrides[action.gameId];
        return withStalenessCheck({
          ...state,
          matchupOverrides: newOverrides,
          isDirty: true,
        });
      }

      case "SET_SIMULATION_RESULT": {
        const inputHash = computeInputHash(
          state.picks,
          state.globalLevers,
          state.matchupOverrides
        );
        return {
          ...state,
          simulationResult: action.result,
          isSimulating: false,
          simulationProgress: null,
          simulationInputHash: inputHash,
          isSimulationStale: false,
        };
      }

      case "SET_SIMULATING": {
        return {
          ...state,
          isSimulating: action.isSimulating,
          // Clear progress when simulation starts or stops
          simulationProgress: action.isSimulating ? null : state.simulationProgress,
        };
      }

      case "SET_SIMULATION_PROGRESS": {
        return {
          ...state,
          simulationProgress: action.progress,
        };
      }

      case "LOAD_BRACKET": {
        const { bracket } = action;
        // If the loaded bracket had a simulation snapshot, compute its hash
        // to enable staleness detection if user modifies the loaded state
        const loadedHash = bracket.simulationSnapshot
          ? computeInputHash(bracket.picks, bracket.globalLevers, bracket.matchupOverrides)
          : null;
        return {
          ...state,
          bracketId: bracket.bracketId,
          bracketName: bracket.name,
          picks: bracket.picks,
          globalLevers: bracket.globalLevers,
          matchupOverrides: bracket.matchupOverrides,
          simulationResult: bracket.simulationSnapshot,
          simulationInputHash: loadedHash,
          isSimulationStale: false,
          isDirty: false,
        };
      }

      case "CLEAR_BRACKET": {
        return {
          ...state,
          picks: {},
          globalLevers: { ...DEFAULT_GLOBAL_LEVERS },
          matchupOverrides: {},
          simulationResult: null,
          isSimulating: false,
          simulationProgress: null,
          simulationInputHash: null,
          isSimulationStale: false,
          bracketId: null,
          bracketName: "My Bracket",
          isDirty: false,
          poolSizeBucket: "medium",
          tournamentSiteMap: null,
        };
      }

      case "CLEAR_PICKS": {
        return {
          ...state,
          picks: {},
          simulationResult: null,
          isSimulating: false,
          simulationProgress: null,
          simulationInputHash: null,
          isSimulationStale: false,
          isDirty: state.bracketId ? true : false,
        };
      }

      case "MARK_SAVED": {
        return {
          ...state,
          bracketId: action.bracketId,
          isDirty: false,
        };
      }

      case "SET_POOL_SIZE": {
        return {
          ...state,
          poolSizeBucket: action.poolSizeBucket,
          isDirty: true,
        };
      }

      case "SET_TOURNAMENT_SITE_MAP": {
        return {
          ...state,
          tournamentSiteMap: action.siteMap,
        };
      }

      default:
        return state;
    }
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface BracketProviderProps {
  children: ReactNode;
  /** Initial tournament teams (64 without play-ins, or 68 with play-ins) */
  initialTeams: TeamSeason[];
  /** Optional saved bracket to restore */
  savedBracket?: SavedBracketData;
  /** Optional tournament site data for site proximity calculations */
  tournamentSites?: TournamentSite[];
  /** Optional play-in configuration for First Four games */
  playInConfig?: PlayInConfig | null;
}

/**
 * BracketProvider manages the full bracket state via React Context + useReducer.
 *
 * Wraps the bracket view and all child components. Provides state and dispatch
 * through BracketContext, accessed via the useBracket() hook.
 *
 * Features:
 * - ADVANCE_TEAM automatically cascades downstream pick invalidation
 * - Supports loading saved brackets and resetting to defaults
 * - Tracks dirty state for unsaved changes
 * - SET_POOL_SIZE updates the contest pool size for game theory recommendations
 * - Dynamic matchup tree: includes First Four games when playInConfig is provided
 */
export function BracketProvider({
  children,
  initialTeams,
  savedBracket,
  tournamentSites,
  playInConfig,
}: BracketProviderProps) {
  const teamsMap = useMemo(() => {
    const map = new Map<string, TeamSeason>();
    for (const team of initialTeams) {
      map.set(team.teamId, team);
    }
    return map;
  }, [initialTeams]);

  // Build matchup tree dynamically based on play-in config.
  // With play-ins: 67 games (4 FF + 63 main). Without: 63 games.
  const allMatchups = useMemo(
    () => buildBracketMatchups(playInConfig),
    [playInConfig]
  );

  // Build downstream cascade map from the dynamic matchup tree
  const downstreamMap = useMemo(
    () => buildDownstreamMap(allMatchups),
    [allMatchups]
  );

  // Build site map from tournament sites (computed once)
  const siteMap = useMemo(() => {
    if (!tournamentSites || tournamentSites.length === 0) {
      return null;
    }
    return buildSiteMap(allMatchups, tournamentSites);
  }, [tournamentSites, allMatchups]);

  // Create reducer that closes over the dynamic downstream map
  const reducer = useCallback(
    createBracketReducer(downstreamMap),
    [downstreamMap]
  );

  const initialState: BracketState = useMemo(
    () => ({
      teams: teamsMap,
      picks: savedBracket?.picks ?? {},
      globalLevers: savedBracket?.globalLevers ?? { ...DEFAULT_GLOBAL_LEVERS },
      matchupOverrides: savedBracket?.matchupOverrides ?? {},
      simulationResult: savedBracket?.simulationSnapshot ?? null,
      isSimulating: false,
      simulationProgress: null,
      simulationInputHash: savedBracket?.simulationSnapshot
        ? computeInputHash(
            savedBracket.picks,
            savedBracket.globalLevers,
            savedBracket.matchupOverrides
          )
        : null,
      isSimulationStale: false,
      bracketId: savedBracket?.bracketId ?? null,
      bracketName: savedBracket?.name ?? "My Bracket",
      isDirty: false,
      poolSizeBucket: "medium",
      tournamentSiteMap: siteMap,
      playInConfig: playInConfig ?? null,
    }),
    [teamsMap, savedBracket, siteMap, playInConfig]
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<BracketContextValue>(
    () => ({ state, dispatch }),
    [state, dispatch]
  );

  return (
    <BracketContext.Provider value={value}>{children}</BracketContext.Provider>
  );
}
