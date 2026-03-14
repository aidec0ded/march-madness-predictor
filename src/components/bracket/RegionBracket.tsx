"use client";

/**
 * RegionBracket — renders one region's bracket (15 matchups) in a CSS Grid.
 *
 * The grid uses 7 columns × 16 rows. Odd columns (1, 3, 5, 7) hold matchup
 * slots; even columns (2, 4, 6) hold bracket fork connector lines that
 * visually connect feeder matchups to their target matchup in the next round.
 *
 * The direction prop controls whether R64 is on the left (ltr) or right (rtl),
 * allowing the full bracket to fold inward toward the center Final Four.
 *
 * Connector lines between rounds are drawn as bracket forks (┐│┘ or ┌│└)
 * using CSS borders on spacer divs in the dedicated connector columns.
 *
 * Most data (teams, picks, simulation results, overrides, ownership, game
 * probabilities, play-in config) is consumed directly from BracketContext and
 * related hooks, eliminating prop drilling from parent components.
 */

import React, { useCallback } from "react";
import type { Region, TournamentRound } from "@/types/team";
import type { BracketMatchup, SimulationResult } from "@/types/simulation";
import { useBracket } from "@/hooks/useBracket";
import { useContestStrategy } from "@/hooks/useContestStrategy";
import { useGameProbabilities } from "@/hooks/useGameProbabilities";
import { MatchupSlot } from "@/components/bracket/MatchupSlot";
import { getRegionMatchupPosition, getConnectorColumn } from "@/lib/bracket-layout";
import { resolveMatchupTeams } from "@/lib/bracket-utils";
import styles from "./RegionBracket.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegionBracketProps {
  /** The region this bracket represents */
  region: Region;
  /** Display direction: ltr puts R64 on left, rtl puts R64 on right */
  direction: "ltr" | "rtl";
  /** All 15 matchups for this region (R64 through E8) */
  matchups: BracketMatchup[];
  /** Called when user clicks a matchup for detail view */
  onMatchupClick?: (gameId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a round to the next round, used for extracting path probabilities.
 *
 * Path probability for a matchup = P(advancing past this round) =
 * simulation's roundProbabilities[nextRound]. For NCG, use championshipProbability.
 */
const NEXT_ROUND: Record<string, TournamentRound | "champion"> = {
  R64: "R32",
  R32: "S16",
  S16: "E8",
  E8: "F4",
  F4: "NCG",
  NCG: "champion",
};

/**
 * Gets the path probability for a team in a matchup from simulation results.
 *
 * This is the probability of advancing past this round (reaching the next round),
 * shown as a tooltip supplement to the per-game win probability.
 */
function getPathProbability(
  teamId: string | undefined,
  round: string,
  simulationResult: SimulationResult | null
): number | null {
  if (!teamId || !simulationResult) return null;
  const teamResult = simulationResult.teamResults.find(
    (r) => r.teamId === teamId
  );
  if (!teamResult) return null;

  const nextRound = NEXT_ROUND[round];
  if (!nextRound) return null;

  if (nextRound === "champion") {
    return teamResult.championshipProbability;
  }

  return teamResult.roundProbabilities[nextRound] ?? null;
}

/**
 * Generates connector line data for connecting feeder games to their
 * target game in the next round.
 */
interface ConnectorLine {
  key: string;
  gridRowStart: number;
  gridRowEnd: number;
  gridColumn: number;
  isActive: boolean;
  direction: "ltr" | "rtl";
}

function generateConnectors(
  matchups: BracketMatchup[],
  picks: Record<string, string>,
  direction: "ltr" | "rtl"
): ConnectorLine[] {
  const connectors: ConnectorLine[] = [];

  // Connectors go between rounds: R64->R32, R32->S16, S16->E8
  const laterRounds = matchups.filter((m) => m.round !== "R64");

  for (const matchup of laterRounds) {
    // Place connector in the dedicated connector column between rounds
    const connectorColumn = getConnectorColumn(matchup.round, direction);

    // Span from feeder A top to feeder B bottom
    const feederAPos = getRegionMatchupPosition(
      matchup.teamASource,
      direction
    );
    const feederBPos = getRegionMatchupPosition(
      matchup.teamBSource,
      direction
    );

    const hasWinnerA = !!picks[matchup.teamASource];
    const hasWinnerB = !!picks[matchup.teamBSource];
    const isActive = hasWinnerA || hasWinnerB;

    connectors.push({
      key: `conn-${matchup.gameId}`,
      gridRowStart: feederAPos.gridRowStart,
      gridRowEnd: feederBPos.gridRowEnd,
      gridColumn: connectorColumn,
      isActive,
      direction,
    });
  }

  return connectors;
}

/**
 * Returns the staggered animation delay (ms) for a round,
 * creating a cascade effect: R64 appears first, then R32, S16, E8.
 */
function getRoundDelay(round: string): number {
  switch (round) {
    case "R64": return 0;
    case "R32": return 100;
    case "S16": return 200;
    case "E8": return 300;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegionBracket({
  region,
  direction,
  matchups,
  onMatchupClick,
}: RegionBracketProps) {
  const { state, dispatch } = useBracket();
  const { ownershipModel } = useContestStrategy();
  const gameProbabilities = useGameProbabilities();

  const { teams, picks, simulationResult, matchupOverrides, playInConfig,
    isSimulationStale } = state;

  // Preview mode: probabilities are live estimates without full simulation confirmation
  const isPreview = simulationResult === null || isSimulationStale;

  const handleAdvance = useCallback(
    (gameId: string, teamId: string) => {
      dispatch({ type: "ADVANCE_TEAM", gameId, teamId });
    },
    [dispatch]
  );

  const connectors = generateConnectors(matchups, picks, direction);

  return (
    <div className={styles.wrapper}>
      {/* Region header */}
      <h3
        className={`${styles.regionHeader} ${direction === "ltr" ? styles.regionHeaderLtr : styles.regionHeaderRtl}`}
      >
        {region}
      </h3>

      {/* Grid container */}
      <div className={styles.grid}>
        {/* Bracket fork connector lines */}
        {connectors.map((conn) => (
          <div
            key={conn.key}
            className={styles.connectorCell}
            style={{
              gridRowStart: conn.gridRowStart,
              gridRowEnd: conn.gridRowEnd,
              gridColumn: conn.gridColumn,
            }}
          >
            <div
              className={`${styles.connectorLine} ${conn.direction === "ltr" ? styles.connectorLineLtr : styles.connectorLineRtl} ${conn.isActive ? styles.connectorLineActive : ""}`}
            />
          </div>
        ))}

        {/* Matchup slots */}
        {matchups.map((matchup) => {
          const pos = getRegionMatchupPosition(matchup.gameId, direction);
          const { teamA, teamB } = resolveMatchupTeams(
            matchup,
            teams,
            picks,
            playInConfig
          );
          const winner = picks[matchup.gameId] ?? null;
          const hasOverrides = matchup.gameId in matchupOverrides;

          // Per-game head-to-head probabilities (from resolveMatchup)
          const gameProb = gameProbabilities?.[matchup.gameId];
          const probA = gameProb?.probA ?? null;
          const probB = gameProb?.probB ?? null;

          // Path probabilities from simulation (for tooltips)
          const pathProbA = getPathProbability(
            teamA?.teamId,
            matchup.round,
            simulationResult
          );
          const pathProbB = getPathProbability(
            teamB?.teamId,
            matchup.round,
            simulationResult
          );

          // Get ownership for this round
          const ownershipA =
            ownershipModel && teamA?.teamId
              ? ownershipModel.getOwnership(teamA.teamId, matchup.round)
              : undefined;
          const ownershipB =
            ownershipModel && teamB?.teamId
              ? ownershipModel.getOwnership(teamB.teamId, matchup.round)
              : undefined;

          return (
            <div
              key={matchup.gameId}
              className={styles.matchupCell}
              style={{
                gridRowStart: pos.gridRowStart,
                gridRowEnd: pos.gridRowEnd,
                gridColumn: pos.gridColumn,
                animationDelay: `${getRoundDelay(matchup.round)}ms`,
              }}
            >
              <MatchupSlot
                gameId={matchup.gameId}
                round={matchup.round}
                teamA={teamA}
                teamB={teamB}
                winner={winner}
                probA={probA}
                probB={probB}
                pathProbA={pathProbA}
                pathProbB={pathProbB}
                hasOverrides={hasOverrides}
                onAdvance={(teamId) => handleAdvance(matchup.gameId, teamId)}
                onMatchupClick={onMatchupClick}
                ownershipA={ownershipA}
                ownershipB={ownershipB}
                isPreview={isPreview}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
