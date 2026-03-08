"use client";

import { memo } from "react";
import type { TeamSeason } from "@/types/team";
import { ProbabilityBar } from "./ProbabilityBar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamCardProps {
  /** Team data (null for empty/TBD slot) */
  team: TeamSeason | null;
  /** Tournament seed */
  seed: number;
  /** Win probability for this round (null if simulation not run) */
  probability: number | null;
  /** Championship probability (null if simulation not run) */
  championshipProbability?: number | null;
  /** Whether this team is the selected winner of the matchup */
  isWinner: boolean;
  /** Whether the card can be clicked to make a pick */
  isClickable: boolean;
  /** Click handler for advancing this team */
  onClick: () => void;
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
 * Shows seed badge, team name, and probability bar.
 * Approximately 160x32px. Highlights the winner with an elevated background
 * and accent-primary left border.
 */
export const TeamCard = memo(function TeamCard({
  team,
  seed,
  probability,
  championshipProbability,
  isWinner,
  isClickable,
  onClick,
}: TeamCardProps) {
  // Empty slot (team not yet determined)
  if (!team) {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded"
        style={{
          minWidth: "160px",
          height: "32px",
          border: "1px dashed var(--border-primary)",
        }}
      >
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          TBD
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`flex flex-col justify-center gap-0.5 px-2 py-1 rounded transition-colors
        ${isClickable ? "cursor-pointer hover:brightness-110" : "cursor-default"}
      `}
      style={{
        minWidth: "160px",
        minHeight: "32px",
        backgroundColor: isWinner ? "var(--bg-elevated)" : "transparent",
        borderLeft: isWinner
          ? "2px solid var(--accent-primary)"
          : "2px solid transparent",
      }}
      title={
        championshipProbability != null
          ? `Championship: ${(championshipProbability * 100).toFixed(1)}%`
          : undefined
      }
    >
      {/* Top row: seed + name */}
      <div className="flex items-center gap-1.5 w-full">
        <span
          className="text-[10px] font-bold font-mono leading-none shrink-0"
          style={{ color: getSeedColor(seed), minWidth: "14px" }}
        >
          {seed}
        </span>
        <span
          className="text-xs font-medium leading-none truncate"
          style={{
            color: isWinner
              ? "var(--text-primary)"
              : "var(--text-secondary)",
          }}
        >
          {team.team.shortName}
        </span>
        {probability != null && (
          <span
            className="text-[10px] font-mono tabular-nums leading-none ml-auto shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {(probability * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Probability bar */}
      {probability != null && (
        <div className="w-full">
          <ProbabilityBar probability={probability} />
        </div>
      )}
    </button>
  );
});
