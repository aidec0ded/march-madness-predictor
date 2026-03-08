"use client";

import { Tooltip } from "@/components/ui/Tooltip";

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
    <div className="absolute top-1 right-1 z-10">
      <Tooltip content="Per-matchup overrides applied" position="top">
        <div
          className="rounded-full"
          style={{
            width: "8px",
            height: "8px",
            backgroundColor: "var(--accent-warning)",
            boxShadow: "0 0 4px var(--accent-warning)",
          }}
        />
      </Tooltip>
    </div>
  );
}
