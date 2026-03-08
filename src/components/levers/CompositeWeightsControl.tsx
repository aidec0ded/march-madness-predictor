"use client";

import React, { useCallback } from "react";
import type { CompositeWeights } from "@/types/engine";
import { Slider } from "@/components/ui/Slider";

export interface CompositeWeightsControlProps {
  weights: CompositeWeights;
  onChange: (weights: CompositeWeights) => void;
}

const SOURCES: { key: keyof CompositeWeights; label: string }[] = [
  { key: "kenpom", label: "KenPom" },
  { key: "torvik", label: "Torvik" },
  { key: "evanmiya", label: "Evan Miya" },
];

/**
 * Three linked sliders for KenPom / Torvik / Evan Miya composite weights.
 * When one slider changes, the others adjust proportionally so the total
 * always sums to 1.0.
 */
export function CompositeWeightsControl({
  weights,
  onChange,
}: CompositeWeightsControlProps) {
  const handleChange = useCallback(
    (changedKey: keyof CompositeWeights, newValue: number) => {
      // Clamp to [0, 1]
      const clamped = Math.min(1, Math.max(0, newValue));
      const remaining = 1 - clamped;

      // Sum of the other two weights (before change)
      const otherKeys = SOURCES.map((s) => s.key).filter(
        (k) => k !== changedKey,
      );
      const otherSum = otherKeys.reduce((sum, k) => sum + weights[k], 0);

      const updated: CompositeWeights = { ...weights, [changedKey]: clamped };

      if (otherSum > 0) {
        // Distribute remaining proportionally among the other two
        for (const k of otherKeys) {
          updated[k] =
            Math.round((weights[k] / otherSum) * remaining * 100) / 100;
        }
      } else {
        // If the other two are both 0, split equally
        for (const k of otherKeys) {
          updated[k] = Math.round((remaining / otherKeys.length) * 100) / 100;
        }
      }

      // Fix rounding drift: ensure sum is exactly 1.0
      const total = updated.kenpom + updated.torvik + updated.evanmiya;
      if (total !== 1) {
        const diff = 1 - total;
        // Add the rounding error to the first non-changed key
        updated[otherKeys[0]] =
          Math.round((updated[otherKeys[0]] + diff) * 100) / 100;
      }

      onChange(updated);
    },
    [weights, onChange],
  );

  return (
    <div className="composite-weights">
      {SOURCES.map(({ key, label }) => (
        <div key={key} className="composite-weights__row">
          <div className="composite-weights__header">
            <span className="composite-weights__label">{label}</span>
            <span className="composite-weights__pct">
              {Math.round(weights[key] * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={weights[key]}
            onChange={(val) => handleChange(key, val)}
          />
        </div>
      ))}
      <style jsx>{`
        .composite-weights {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .composite-weights__row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .composite-weights__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .composite-weights__label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .composite-weights__pct {
          font-size: 0.8125rem;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
          font-weight: 600;
          color: var(--accent-primary);
        }
      `}</style>
    </div>
  );
}
