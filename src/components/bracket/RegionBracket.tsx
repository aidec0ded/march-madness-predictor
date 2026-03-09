"use client";

/**
 * RegionBracket — renders one region's bracket (15 matchups) in a CSS Grid.
 *
 * The grid uses 4 columns x 16 rows. R64 games are in the outermost column,
 * with each successive round moving inward and spanning more rows so matchups
 * center between their feeder games.
 *
 * The direction prop controls whether R64 is on the left (ltr) or right (rtl),
 * allowing the full bracket to fold inward toward the center Final Four.
 *
 * Connector lines between rounds are drawn using CSS borders on spacer divs.
 */

import React from "react";
import type { Region, TeamSeason, TournamentRound } from "@/types/team";
import type { BracketMatchup, SimulationResult } from "@/types/simulation";
import type { MatchupOverrides } from "@/types/engine";
import type { OwnershipModel } from "@/types/game-theory";
import { MatchupSlot } from "@/components/bracket/MatchupSlot";
import { getRegionMatchupPosition } from "@/lib/bracket-layout";
import { resolveMatchupTeams } from "@/lib/bracket-utils";

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Gets the win probability for a team in a specific round from simulation results.
 */
function getTeamProbability(
  teamId: string | undefined,
  round: TournamentRound,
  simulationResult: SimulationResult | null
): number | null {
  if (!teamId || !simulationResult) return null;
  const teamResult = simulationResult.teamResults.find(
    (r) => r.teamId === teamId
  );
  if (!teamResult) return null;
  return teamResult.roundProbabilities[round] ?? null;
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
    const targetPos = getRegionMatchupPosition(matchup.gameId, direction);

    // We draw vertical connectors spanning from feeder A midpoint to feeder B midpoint
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
      gridColumn: targetPos.gridColumn,
      isActive,
      direction,
    });
  }

  return connectors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegionBracket({
  region,
  direction,
  matchups,
  teams,
  picks,
  simulationResult,
  matchupOverrides,
  onAdvance,
  onMatchupClick,
  ownershipModel,
}: RegionBracketProps) {
  const connectors = generateConnectors(matchups, picks, direction);

  return (
    <div className="region-bracket" style={{ position: "relative" }}>
      {/* Region header */}
      <h3
        style={{
          color: "var(--text-primary)",
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          padding: "4px 8px",
          marginBottom: "4px",
          textAlign: direction === "ltr" ? "left" : "right",
          borderBottom: "2px solid var(--accent-primary)",
        }}
      >
        {region}
      </h3>

      {/* Grid container */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            direction === "ltr"
              ? "minmax(140px, 180px) minmax(140px, 180px) minmax(140px, 180px) minmax(140px, 180px)"
              : "minmax(140px, 180px) minmax(140px, 180px) minmax(140px, 180px) minmax(140px, 180px)",
          gridTemplateRows: "repeat(16, minmax(28px, 1fr))",
          gap: "0px 8px",
          padding: "4px 0",
          position: "relative",
        }}
      >
        {/* Connector lines */}
        {connectors.map((conn) => (
          <div
            key={conn.key}
            style={{
              gridRowStart: conn.gridRowStart,
              gridRowEnd: conn.gridRowEnd,
              gridColumn: conn.gridColumn,
              display: "flex",
              alignItems: "center",
              justifyContent:
                conn.direction === "ltr" ? "flex-start" : "flex-end",
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            <div
              style={{
                width: "8px",
                height: "100%",
                borderTop: "none",
                borderBottom: "none",
                ...(conn.direction === "ltr"
                  ? {
                      borderLeft: `2px solid ${conn.isActive ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                    }
                  : {
                      borderRight: `2px solid ${conn.isActive ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                    }),
                transition: "border-color 0.2s ease",
              }}
            />
          </div>
        ))}

        {/* Matchup slots */}
        {matchups.map((matchup) => {
          const pos = getRegionMatchupPosition(matchup.gameId, direction);
          const { teamA, teamB } = resolveMatchupTeams(
            matchup,
            teams,
            picks
          );
          const winner = picks[matchup.gameId] ?? null;
          const hasOverrides = matchup.gameId in matchupOverrides;

          // Get probabilities for this specific round
          const probA = getTeamProbability(
            teamA?.teamId,
            matchup.round,
            simulationResult
          );
          const probB = getTeamProbability(
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
              style={{
                gridRowStart: pos.gridRowStart,
                gridRowEnd: pos.gridRowEnd,
                gridColumn: pos.gridColumn,
                display: "flex",
                alignItems: "center",
                zIndex: 1,
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
                hasOverrides={hasOverrides}
                onAdvance={(teamId) => onAdvance(matchup.gameId, teamId)}
                onMatchupClick={onMatchupClick}
                ownershipA={ownershipA}
                ownershipB={ownershipB}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
