"use client";

/**
 * PoolSizeSelector — compact dropdown for selecting the contest pool size.
 *
 * Renders in the header bar. Dispatches SET_POOL_SIZE to update the
 * bracket state, which in turn affects ownership-weighted strategy
 * recommendations throughout the UI.
 *
 * Styling:
 * - Tailwind for layout only (flex, gap, px, py, rounded, text-xs, etc.)
 * - CSS variables for ALL colors via inline styles
 * - styled-jsx for hover/focus states
 */

import { useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { POOL_STRATEGY_CONFIGS } from "@/lib/game-theory/strategy";
import type { PoolSizeBucket } from "@/types/game-theory";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ordered list of pool size options for the dropdown */
const POOL_OPTIONS: { value: PoolSizeBucket; label: string }[] = [
  { value: "small", label: POOL_STRATEGY_CONFIGS.small.label },
  { value: "medium", label: POOL_STRATEGY_CONFIGS.medium.label },
  { value: "large", label: POOL_STRATEGY_CONFIGS.large.label },
  { value: "very_large", label: POOL_STRATEGY_CONFIGS.very_large.label },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact pool size selector dropdown for the bracket header.
 *
 * Displays the current pool size bucket and allows the user to change it.
 * The selected pool size affects how strategy recommendations are
 * generated across the entire bracket.
 */
export function PoolSizeSelector() {
  const { state, dispatch } = useBracket();
  const currentBucket = state.poolSizeBucket ?? "medium";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch({
        type: "SET_POOL_SIZE",
        poolSizeBucket: e.target.value as PoolSizeBucket,
      });
    },
    [dispatch]
  );

  const currentConfig = POOL_STRATEGY_CONFIGS[currentBucket];

  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor="pool-size-select"
        className="text-xs font-semibold"
        style={{ color: "var(--text-muted)" }}
      >
        Pool
      </label>
      <select
        id="pool-size-select"
        value={currentBucket}
        onChange={handleChange}
        className="pool-size-select rounded px-2 py-1 text-xs font-medium"
        style={{
          color: "var(--text-primary)",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-primary)",
          outline: "none",
          cursor: "pointer",
          minWidth: "120px",
        }}
        title={currentConfig.description}
      >
        {POOL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <style jsx>{`
        .pool-size-select:hover {
          border-color: var(--accent-primary);
        }
        .pool-size-select:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 1px var(--accent-primary);
        }
      `}</style>
    </div>
  );
}
