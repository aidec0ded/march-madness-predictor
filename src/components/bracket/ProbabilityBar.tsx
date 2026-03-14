import { memo } from "react";
import styles from "./ProbabilityBar.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProbabilityBarProps {
  /** Probability value between 0 and 1 */
  probability: number;
  /** Whether this probability is a preview estimate (no confirmed simulation) */
  isPreview?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps probability to a color using blue/red duality:
 * - 0.0 - 0.40: --accent-danger (red, clear underdog)
 * - 0.40 - 0.60: --accent-warning (amber, competitive / toss-up)
 * - 0.60 - 1.0: --accent-primary (blue, clear favorite)
 *
 * This aligns with the matchup view's blue/red accent system
 * and communicates competitive dynamics at a glance.
 */
function getBarColor(probability: number): string {
  if (probability < 0.4) return "var(--accent-danger)";
  if (probability <= 0.6) return "var(--accent-warning)";
  return "var(--accent-primary)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal probability bar.
 *
 * A 5px-high bar whose width represents the probability (0-100%)
 * and whose color uses blue/red duality: blue for favorites,
 * red for underdogs, amber for toss-ups.
 */
export const ProbabilityBar = memo(function ProbabilityBar({
  probability,
  isPreview,
}: ProbabilityBarProps) {
  const widthPercent = Math.min(Math.max(probability, 0), 1) * 100;
  const color = getBarColor(probability);

  return (
    <div className={styles.track}>
      <div
        className={`${styles.fill}${isPreview ? ` ${styles.fillPreview}` : ""}`}
        style={{
          width: `${widthPercent}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
});
