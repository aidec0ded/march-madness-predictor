import { memo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProbabilityBarProps {
  /** Probability value between 0 and 1 */
  probability: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Interpolates bar color based on probability:
 * - 0.0 - 0.3: --accent-danger (red)
 * - 0.3 - 0.6: --accent-warning (yellow)
 * - 0.6 - 1.0: --accent-success (green)
 */
function getBarColor(probability: number): string {
  if (probability < 0.3) return "var(--accent-danger)";
  if (probability < 0.6) return "var(--accent-warning)";
  return "var(--accent-success)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal probability bar.
 *
 * A 3px-high bar whose width represents the probability (0-100%)
 * and whose color interpolates from red (low) to green (high).
 */
export const ProbabilityBar = memo(function ProbabilityBar({
  probability,
}: ProbabilityBarProps) {
  const widthPercent = Math.min(Math.max(probability, 0), 1) * 100;
  const color = getBarColor(probability);

  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{
        height: "3px",
        backgroundColor: "var(--bg-elevated)",
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${widthPercent}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
});
