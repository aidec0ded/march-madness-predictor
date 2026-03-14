"use client";

import { memo } from "react";
import type { TeamSeason } from "@/types/team";
import { ProbabilityBar } from "./ProbabilityBar";
import { OwnershipBadge } from "./OwnershipBadge";
import styles from "./TeamCard.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamCardProps {
  /** Team data (null for empty/TBD slot) */
  team: TeamSeason | null;
  /** Tournament seed */
  seed: number;
  /** Per-game head-to-head win probability (null if not yet computable) */
  probability: number | null;
  /** Path probability — P(advancing past this round) from simulation (optional) */
  pathProbability?: number | null;
  /** Championship probability (null if simulation not run) */
  championshipProbability?: number | null;
  /** Whether this team is the selected winner of the matchup */
  isWinner: boolean;
  /** Whether the card can be clicked to make a pick */
  isClickable: boolean;
  /** Click handler for advancing this team */
  onClick: () => void;
  /** Estimated public ownership percentage for this round (optional) */
  ownership?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the seed badge color based on seed grouping:
 * - 1-4:  --accent-primary (blue)
 * - 5-8:  --accent-info (indigo)
 * - 9-12: --accent-warning (amber)
 * - 13-16: --text-muted (gray)
 */
function getSeedColor(seed: number): string {
  if (seed <= 4) return "var(--accent-primary)";
  if (seed <= 8) return "var(--accent-info)";
  if (seed <= 12) return "var(--accent-warning)";
  return "var(--text-muted)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact team card for bracket display.
 *
 * Shows seed badge, team name, probability bar, and optional ownership badge.
 * Approximately 160x32px. Highlights the winner with an elevated background
 * and accent-primary left border.
 */
export const TeamCard = memo(function TeamCard({
  team,
  seed,
  probability,
  pathProbability,
  championshipProbability,
  isWinner,
  isClickable,
  onClick,
  ownership,
}: TeamCardProps) {
  // Empty slot (team not yet determined)
  if (!team) {
    return (
      <div
        className={styles.emptySlot}
        style={{ border: "1px dashed var(--border-primary)" }}
      >
        <span className={styles.emptyLabel}>TBD</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${seed} seed ${team.team.name}${isWinner ? ", selected winner" : ""}${probability != null ? `, ${(probability * 100).toFixed(0)}% win probability` : ""}`}
      disabled={!isClickable}
      className={`${styles.card} ${isClickable ? styles.clickable : ""}`}
      style={{
        backgroundColor: isWinner ? "var(--bg-elevated)" : "transparent",
        borderLeft: isWinner
          ? "2px solid var(--accent-primary)"
          : "2px solid transparent",
      }}
      title={
        pathProbability != null
          ? `Sim path: ${(pathProbability * 100).toFixed(1)}% to advance${championshipProbability != null ? ` | Championship: ${(championshipProbability * 100).toFixed(1)}%` : ""}`
          : championshipProbability != null
            ? `Championship: ${(championshipProbability * 100).toFixed(1)}%`
            : undefined
      }
    >
      {/* Top row: seed + name + probability + ownership */}
      <div className={styles.topRow}>
        <span
          className={styles.seed}
          style={{ color: getSeedColor(seed) }}
        >
          {seed}
        </span>
        <span
          className={styles.teamName}
          style={{
            color: isWinner
              ? "var(--text-primary)"
              : "var(--text-secondary)",
          }}
        >
          {team.team.shortName}
        </span>
        {ownership != null && (
          <OwnershipBadge ownershipPct={ownership} />
        )}
        {probability != null && (
          <span className={styles.probability}>
            {(probability * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Probability bar */}
      {probability != null && (
        <div className={styles.barWrapper}>
          <ProbabilityBar probability={probability} />
        </div>
      )}
    </button>
  );
});
