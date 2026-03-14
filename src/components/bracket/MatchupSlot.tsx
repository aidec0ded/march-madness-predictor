"use client";

import type { TeamSeason } from "@/types/team";
import { TeamCard } from "./TeamCard";
import { OverrideIndicator } from "./OverrideIndicator";
import styles from "./MatchupSlot.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchupSlotProps {
  /** Unique game identifier */
  gameId: string;
  /** Tournament round (used for display context) */
  round: string;
  /** Team A in this matchup (null if not yet determined) */
  teamA: TeamSeason | null;
  /** Team B in this matchup (null if not yet determined) */
  teamB: TeamSeason | null;
  /** ID of the winning team (null if no pick made) */
  winner: string | null;
  /** Win probability for team A (null if not yet computable) */
  probA: number | null;
  /** Win probability for team B (null if not yet computable) */
  probB: number | null;
  /** Path probability for team A — P(advancing past this round) from simulation (optional) */
  pathProbA?: number | null;
  /** Path probability for team B — P(advancing past this round) from simulation (optional) */
  pathProbB?: number | null;
  /** Whether per-matchup overrides are applied */
  hasOverrides: boolean;
  /** Handler for advancing a team (picking a winner) */
  onAdvance: (teamId: string) => void;
  /** Optional handler for clicking the matchup container to view details */
  onMatchupClick?: (gameId: string) => void;
  /** Ownership percentage for team A (optional) */
  ownershipA?: number;
  /** Ownership percentage for team B (optional) */
  ownershipB?: number;
  /** Whether probabilities are preview estimates (no confirmed simulation) */
  isPreview?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Matchup container that renders two TeamCards stacked vertically.
 *
 * Features:
 * - Two teams separated by a 1px divider
 * - --bg-surface background with rounded corners
 * - OverrideIndicator dot when per-matchup overrides exist
 * - Optional click handler for navigating to matchup detail view
 * - Passes ownership data through to TeamCard for display
 */
export function MatchupSlot({
  gameId,
  round,
  teamA,
  teamB,
  winner,
  probA,
  probB,
  pathProbA,
  pathProbB,
  hasOverrides,
  onAdvance,
  onMatchupClick,
  ownershipA,
  ownershipB,
  isPreview,
}: MatchupSlotProps) {
  const seedA = teamA?.tournamentEntry?.seed ?? 0;
  const seedB = teamB?.tournamentEntry?.seed ?? 0;

  return (
    <div className={styles.container}>
      {/* Override indicator */}
      {hasOverrides && <OverrideIndicator />}

      {/* Team A */}
      <TeamCard
        team={teamA}
        seed={seedA}
        probability={probA}
        pathProbability={pathProbA}
        isWinner={winner === teamA?.teamId}
        isClickable={teamA != null}
        onClick={() => {
          if (teamA) onAdvance(teamA.teamId);
        }}
        ownership={ownershipA}
        isPreview={isPreview}
      />

      {/* Divider */}
      <div className={styles.divider} />

      {/* Team B */}
      <TeamCard
        team={teamB}
        seed={seedB}
        probability={probB}
        pathProbability={pathProbB}
        isWinner={winner === teamB?.teamId}
        isClickable={teamB != null}
        onClick={() => {
          if (teamB) onAdvance(teamB.teamId);
        }}
        ownership={ownershipB}
        isPreview={isPreview}
      />

      {/* Matchup click overlay (for navigating to detail view) */}
      {onMatchupClick && (
        <button
          type="button"
          onClick={() => onMatchupClick(gameId)}
          className={styles.detailButton}
          aria-label={`View matchup details for ${gameId}`}
          title="View matchup details"
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
            className={styles.detailIcon}
          >
            <path d="M3.5 1.5L7 5L3.5 8.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
