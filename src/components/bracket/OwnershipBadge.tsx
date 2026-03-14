"use client";

/**
 * OwnershipBadge — tiny inline badge showing estimated public ownership.
 *
 * Renders as "X% owned" in a compact format, color-coded by ownership level:
 * - High ownership (>60%): accent-warning (amber) — chalk/over-owned
 * - Medium ownership (30-60%): text-muted — neutral
 * - Low ownership (<30%): accent-success (green) — contrarian value
 *
 * memo-wrapped since this component renders 128+ times across the bracket
 * (2 per matchup × 64 matchups in the full tree).
 *
 * Styling:
 * - CSS Modules for static layout and typography
 * - Inline styles only for dynamic color (ownership threshold)
 */

import { memo } from "react";
import styles from "./OwnershipBadge.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OwnershipBadgeProps {
  /** Estimated public ownership percentage (0-100) */
  ownershipPct: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the CSS variable name for the badge color based on ownership level.
 *
 * @param pct - Ownership percentage (0-100)
 * @returns CSS variable string for the color
 */
function getOwnershipColor(pct: number): string {
  if (pct >= 60) return "var(--accent-warning)";
  if (pct >= 30) return "var(--text-muted)";
  return "var(--accent-success)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact ownership badge for inline display in team cards.
 *
 * @example
 * ```tsx
 * <OwnershipBadge ownershipPct={45.2} />
 * // Renders: "45% owned"
 * ```
 */
export const OwnershipBadge = memo(function OwnershipBadge({
  ownershipPct,
}: OwnershipBadgeProps) {
  const color = getOwnershipColor(ownershipPct);
  const displayPct = Math.round(ownershipPct);

  return (
    <span
      className={styles.badge}
      style={{ color }}
      title={`Estimated ${ownershipPct.toFixed(1)}% public ownership. Based on: NCAA.com seed pick rates, conference strength, rating differential, and brand recognition. Always sums to 100% per matchup.`}
    >
      {displayPct}%
      <span className={styles.label}>
        own
      </span>
    </span>
  );
});
