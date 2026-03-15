"use client";

/**
 * FinalFour — renders the center section of the bracket: F4-1, F4-2, and NCG.
 *
 * Layout:
 * - F4 Game 1 at top (East vs West winners)
 * - National Championship in the middle
 * - F4 Game 2 at bottom (South vs Midwest winners)
 * - Champion display below NCG when a winner is selected
 *
 * Teams are resolved from E8 winners in the picks map.
 */

import React from "react";
import type { TeamSeason, TournamentRound } from "@/types/team";
import type { BracketMatchup, SimulationResult } from "@/types/simulation";
import type { MatchupOverrides } from "@/types/engine";
import type { GameProbabilities } from "@/hooks/useGameProbabilities";
import { MatchupSlot } from "@/components/bracket/MatchupSlot";
import styles from "./FinalFour.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FinalFourProps {
  /** The 3 Final Four matchups: F4-1, F4-2, NCG */
  matchups: BracketMatchup[];
  /** All tournament teams keyed by teamId */
  teams: Map<string, TeamSeason>;
  /** User picks: gameId -> winning teamId */
  picks: Record<string, string>;
  /** Simulation results (null if not yet run) */
  simulationResult: SimulationResult | null;
  /** Per-matchup overrides keyed by gameId */
  matchupOverrides: Record<string, MatchupOverrides>;
  /** Called when user picks a team to advance */
  onAdvance: (gameId: string, teamId: string) => void;
  /** Called when user clicks a matchup for detail view */
  onMatchupClick?: (gameId: string) => void;
  /** Per-game head-to-head probabilities from resolveMatchup (optional) */
  gameProbabilities?: GameProbabilities;
  /** Whether probabilities are preview estimates (no confirmed simulation) */
  isPreview?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gets a team from picks + teams map. The source is a gameId whose
 * winner is looked up in picks, then resolved from the teams map.
 */
function resolveTeamFromPick(
  sourceGameId: string,
  picks: Record<string, string>,
  teams: Map<string, TeamSeason>
): TeamSeason | null {
  const winnerId = picks[sourceGameId];
  if (!winnerId) return null;
  return teams.get(winnerId) ?? null;
}

/**
 * Maps a round to the next round, used for extracting path probabilities.
 * For NCG, use championshipProbability instead.
 */
const NEXT_ROUND: Record<string, TournamentRound | "champion"> = {
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
 * Gets the championship probability for a team.
 */
function getChampionshipProbability(
  teamId: string,
  simulationResult: SimulationResult | null
): number | null {
  if (!simulationResult) return null;
  const teamResult = simulationResult.teamResults.find(
    (r) => r.teamId === teamId
  );
  return teamResult?.championshipProbability ?? null;
}

// ---------------------------------------------------------------------------
// Champion Card
// ---------------------------------------------------------------------------

interface ChampionCardProps {
  team: TeamSeason;
  probability: number | null;
}

function ChampionCard({ team, probability }: ChampionCardProps) {
  const seed = team.tournamentEntry?.seed;

  return (
    <div className={styles.championCard}>
      <span className={styles.championTrophy} role="img" aria-label="Trophy">
        🏆
      </span>
      <span className={styles.championTitle}>Champion</span>
      <span className={styles.championName}>
        {seed && (
          <span className={styles.championSeed}>({seed})</span>
        )}
        {team.team.shortName}
      </span>
      {probability !== null && (
        <span className={styles.championProb}>
          {(probability * 100).toFixed(1)}% to win
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FinalFour = React.memo(function FinalFour({
  matchups,
  teams,
  picks,
  simulationResult,
  matchupOverrides,
  onAdvance,
  onMatchupClick,
  gameProbabilities,
  isPreview,
}: FinalFourProps) {
  // Sort matchups: F4-1 first, then F4-2, then NCG
  const f4Game1 = matchups.find((m) => m.gameId === "F4-1");
  const f4Game2 = matchups.find((m) => m.gameId === "F4-2");
  const ncg = matchups.find((m) => m.gameId === "NCG");

  // Resolve F4 teams from E8 winners
  const f4Game1TeamA = f4Game1
    ? resolveTeamFromPick(f4Game1.teamASource, picks, teams)
    : null;
  const f4Game1TeamB = f4Game1
    ? resolveTeamFromPick(f4Game1.teamBSource, picks, teams)
    : null;

  const f4Game2TeamA = f4Game2
    ? resolveTeamFromPick(f4Game2.teamASource, picks, teams)
    : null;
  const f4Game2TeamB = f4Game2
    ? resolveTeamFromPick(f4Game2.teamBSource, picks, teams)
    : null;

  // Resolve NCG teams from F4 winners
  const ncgTeamA = ncg
    ? resolveTeamFromPick(ncg.teamASource, picks, teams)
    : null;
  const ncgTeamB = ncg
    ? resolveTeamFromPick(ncg.teamBSource, picks, teams)
    : null;

  // Champion
  const championId = ncg ? picks["NCG"] : undefined;
  const champion = championId ? teams.get(championId) ?? null : null;
  const championProb = championId
    ? getChampionshipProbability(championId, simulationResult)
    : null;

  const hasAnyF4Pick = !!(picks["F4-1"] || picks["F4-2"]);

  return (
    <div className={styles.container}>
      {/* Final Four Header */}
      <h3 className={styles.header}>Final Four</h3>

      {/* F4 Game 1 */}
      {f4Game1 && (
        <div className={styles.matchupWrapper}>
          <MatchupSlot
            gameId={f4Game1.gameId}
            round={f4Game1.round}
            teamA={f4Game1TeamA}
            teamB={f4Game1TeamB}
            winner={picks["F4-1"] ?? null}
            probA={gameProbabilities?.["F4-1"]?.probA ?? null}
            probB={gameProbabilities?.["F4-1"]?.probB ?? null}
            pathProbA={getPathProbability(
              f4Game1TeamA?.teamId,
              "F4",
              simulationResult
            )}
            pathProbB={getPathProbability(
              f4Game1TeamB?.teamId,
              "F4",
              simulationResult
            )}
            hasOverrides={"F4-1" in matchupOverrides}
            onAdvance={(teamId) => onAdvance("F4-1", teamId)}
            onMatchupClick={onMatchupClick}
            isPreview={isPreview}
          />
        </div>
      )}

      {/* Connector: F4 -> NCG */}
      <div
        className={`${styles.connector} ${hasAnyF4Pick ? styles.connectorActive : styles.connectorInactive}`}
      />

      {/* National Championship */}
      {ncg && (
        <div className={styles.matchupWrapper}>
          <div className={styles.championshipLabel}>Championship</div>
          <MatchupSlot
            gameId="NCG"
            round="NCG"
            teamA={ncgTeamA}
            teamB={ncgTeamB}
            winner={picks["NCG"] ?? null}
            probA={gameProbabilities?.["NCG"]?.probA ?? null}
            probB={gameProbabilities?.["NCG"]?.probB ?? null}
            pathProbA={getPathProbability(
              ncgTeamA?.teamId,
              "NCG",
              simulationResult
            )}
            pathProbB={getPathProbability(
              ncgTeamB?.teamId,
              "NCG",
              simulationResult
            )}
            hasOverrides={"NCG" in matchupOverrides}
            onAdvance={(teamId) => onAdvance("NCG", teamId)}
            onMatchupClick={onMatchupClick}
            isPreview={isPreview}
          />
        </div>
      )}

      {/* Champion display */}
      {champion && <ChampionCard team={champion} probability={championProb} />}

      {/* Connector: NCG -> F4 Game 2 */}
      <div
        className={`${styles.connector} ${champion || hasAnyF4Pick ? styles.connectorActive : styles.connectorInactive}`}
      />

      {/* F4 Game 2 */}
      {f4Game2 && (
        <div className={styles.matchupWrapper}>
          <MatchupSlot
            gameId={f4Game2.gameId}
            round={f4Game2.round}
            teamA={f4Game2TeamA}
            teamB={f4Game2TeamB}
            winner={picks["F4-2"] ?? null}
            probA={gameProbabilities?.["F4-2"]?.probA ?? null}
            probB={gameProbabilities?.["F4-2"]?.probB ?? null}
            pathProbA={getPathProbability(
              f4Game2TeamA?.teamId,
              "F4",
              simulationResult
            )}
            pathProbB={getPathProbability(
              f4Game2TeamB?.teamId,
              "F4",
              simulationResult
            )}
            hasOverrides={"F4-2" in matchupOverrides}
            onAdvance={(teamId) => onAdvance("F4-2", teamId)}
            onMatchupClick={onMatchupClick}
            isPreview={isPreview}
          />
        </div>
      )}
    </div>
  );
});

FinalFour.displayName = "FinalFour";
