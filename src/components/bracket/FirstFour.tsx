"use client";

/**
 * FirstFour — renders the 4 First Four play-in games as a horizontal strip.
 *
 * Layout: A row of 4 MatchupSlot cards, each representing one play-in game.
 * Each card shows two teams competing for a single slot in the Round of 64.
 * Labels below each card indicate the region and seed (e.g., "East 16-seed").
 *
 * Displayed above the main bracket grid on desktop, or in its own tab on mobile.
 * Only rendered when the tournament includes 68 teams (play-in config is present).
 */

import React from "react";
import type { TeamSeason, TournamentRound } from "@/types/team";
import type {
  BracketMatchup,
  SimulationResult,
  PlayInConfig,
} from "@/types/simulation";
import type { MatchupOverrides } from "@/types/engine";
import type { OwnershipModel } from "@/types/game-theory";
import type { GameProbabilities } from "@/hooks/useGameProbabilities";
import { resolveSlotTeam } from "@/lib/bracket-utils";
import { MatchupSlot } from "@/components/bracket/MatchupSlot";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FirstFourProps {
  /** The 4 First Four matchups (round === "FF") */
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
  /** Ownership model for displaying ownership badges (optional) */
  ownershipModel?: OwnershipModel | null;
  /** Per-game head-to-head probabilities (optional) */
  gameProbabilities?: GameProbabilities;
  /** Play-in configuration for resolving FF slot teams */
  playInConfig?: PlayInConfig | null;
  /** Whether probabilities are preview estimates (no confirmed simulation) */
  isPreview?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gets the path probability for a team in a First Four matchup.
 * For FF games, this is the probability of reaching R64 (advancing past FF).
 */
function getPathProbability(
  teamId: string | undefined,
  simulationResult: SimulationResult | null
): number | null {
  if (!teamId || !simulationResult) return null;
  const teamResult = simulationResult.teamResults.find(
    (r) => r.teamId === teamId
  );
  if (!teamResult) return null;
  return teamResult.roundProbabilities["R64"] ?? null;
}

/**
 * Extracts region and seed from an FF game ID.
 * e.g., "FF-East-16" → { region: "East", seed: 16 }
 */
function parseFFGameId(gameId: string): {
  region: string;
  seed: number;
} | null {
  const parts = gameId.split("-");
  if (parts.length !== 3 || parts[0] !== "FF") return null;
  return { region: parts[1], seed: parseInt(parts[2], 10) };
}

/**
 * Sorts FF matchups: 16-seed games first, then 11-seed games.
 * Within each seed group, sorts alphabetically by region.
 */
function sortFFMatchups(matchups: BracketMatchup[]): BracketMatchup[] {
  return [...matchups].sort((a, b) => {
    const parsedA = parseFFGameId(a.gameId);
    const parsedB = parseFFGameId(b.gameId);
    if (!parsedA || !parsedB) return 0;

    // 16-seeds first, then 11-seeds
    if (parsedA.seed !== parsedB.seed) return parsedB.seed - parsedA.seed;
    // Alphabetical by region within same seed
    return parsedA.region.localeCompare(parsedB.region);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal strip of 4 First Four play-in matchups.
 *
 * Each card shows two teams competing for a single R64 slot.
 * Labels indicate the region and seed (e.g., "East 16-seed Play-In").
 * Winners flow into the corresponding R64 matchup automatically.
 *
 * Dimensions: ~740px wide (4 x 170px cards + gaps), centered.
 * Uses CSS variables: --bg-surface, --border-subtle, --text-primary,
 *   --text-secondary, --text-muted, --accent-info.
 */
export function FirstFour({
  matchups,
  teams,
  picks,
  simulationResult,
  matchupOverrides,
  onAdvance,
  onMatchupClick,
  ownershipModel,
  gameProbabilities,
  playInConfig,
  isPreview,
}: FirstFourProps) {
  const sorted = sortFFMatchups(matchups);

  if (sorted.length === 0) return null;

  // Game-level ownership helper — returns [ownershipA, ownershipB] summing to 100%
  const getMatchupOwn = (
    teamAId: string | undefined,
    teamBId: string | undefined,
    round: TournamentRound
  ): [number | undefined, number | undefined] => {
    if (!ownershipModel || !teamAId || !teamBId) return [undefined, undefined];
    return ownershipModel.getMatchupOwnership(teamAId, teamBId, round);
  };

  return (
    <div
      className="first-four"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px 16px",
      }}
    >
      {/* Header */}
      <h3
        style={{
          color: "var(--text-primary)",
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          textAlign: "center",
          borderBottom: "2px solid var(--accent-info)",
          paddingBottom: "4px",
          margin: 0,
        }}
      >
        First Four
      </h3>

      {/* Matchup cards row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "16px",
        }}
      >
        {sorted.map((matchup) => {
          const parsed = parseFFGameId(matchup.gameId);
          const teamA = resolveSlotTeam(
            matchup.teamASource,
            teams,
            playInConfig
          );
          const teamB = resolveSlotTeam(
            matchup.teamBSource,
            teams,
            playInConfig
          );
          const winner = picks[matchup.gameId] ?? null;
          const [ownA, ownB] = getMatchupOwn(
            teamA?.teamId,
            teamB?.teamId,
            "FF"
          );

          return (
            <div
              key={matchup.gameId}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                width: "170px",
              }}
            >
              {/* Region + seed label */}
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                {parsed
                  ? `${parsed.region} ${parsed.seed}-seed`
                  : matchup.gameId}
              </div>

              {/* MatchupSlot */}
              <div style={{ width: "100%" }}>
                <MatchupSlot
                  gameId={matchup.gameId}
                  round={matchup.round}
                  teamA={teamA}
                  teamB={teamB}
                  winner={winner}
                  probA={
                    gameProbabilities?.[matchup.gameId]?.probA ?? null
                  }
                  probB={
                    gameProbabilities?.[matchup.gameId]?.probB ?? null
                  }
                  pathProbA={getPathProbability(
                    teamA?.teamId,
                    simulationResult
                  )}
                  pathProbB={getPathProbability(
                    teamB?.teamId,
                    simulationResult
                  )}
                  hasOverrides={matchup.gameId in matchupOverrides}
                  onAdvance={(teamId) =>
                    onAdvance(matchup.gameId, teamId)
                  }
                  onMatchupClick={onMatchupClick}
                  ownershipA={ownA}
                  ownershipB={ownB}
                  isPreview={isPreview}
                />
              </div>

              {/* Arrow indicator showing where winner goes */}
              {winner && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "10px",
                    color: "var(--accent-success)",
                    fontWeight: 500,
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 2L5 8M5 8L2.5 5.5M5 8L7.5 5.5" />
                  </svg>
                  <span>to R64</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
