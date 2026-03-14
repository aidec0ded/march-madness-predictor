"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./OverrideIndicator.module.css";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Small orange dot indicator showing that per-matchup overrides are applied.
 *
 * Positioned absolutely in the top-right corner of its parent container.
 * Wrapped in a Tooltip that explains what the indicator means on hover.
 */
export function OverrideIndicator() {
  return (
    <div className={styles.wrapper}>
      <Tooltip content="Per-matchup overrides applied" position="top">
        <div className={styles.dot} />
      </Tooltip>
    </div>
  );
}
