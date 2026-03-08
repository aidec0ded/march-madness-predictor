"use client";

import React, { useCallback } from "react";
import type { FourFactorsLeverWeights } from "@/types/engine";
import { LeverSlider } from "./LeverSlider";

export interface FourFactorsControlsProps {
  weights: FourFactorsLeverWeights;
  onChange: (weights: FourFactorsLeverWeights) => void;
}

/**
 * Row definitions for the four factors grid.
 * Each row has an offense key, a defense key, and a display label.
 */
const FACTOR_ROWS: {
  label: string;
  offenseKey: keyof FourFactorsLeverWeights;
  defenseKey: keyof FourFactorsLeverWeights;
  description: string;
}[] = [
  {
    label: "Effective FG%",
    offenseKey: "efgPctOffense",
    defenseKey: "efgPctDefense",
    description: "Field goal percentage adjusted for three-pointers.",
  },
  {
    label: "Turnover Rate",
    offenseKey: "toPctOffense",
    defenseKey: "toPctDefense",
    description: "Percentage of possessions ending in a turnover.",
  },
  {
    label: "Offensive Rebound Rate",
    offenseKey: "orbPctOffense",
    defenseKey: "orbPctDefense",
    description: "Percentage of available offensive rebounds grabbed.",
  },
  {
    label: "Free Throw Rate",
    offenseKey: "ftRateOffense",
    defenseKey: "ftRateDefense",
    description: "Free throw attempts relative to field goal attempts.",
  },
];

/**
 * Eight sliders in a 2-column grid (Offense | Defense) for the Four Factors.
 * Range: 0–2, step 0.05, default 1.0.
 */
export function FourFactorsControls({
  weights,
  onChange,
}: FourFactorsControlsProps) {
  const handleChange = useCallback(
    (key: keyof FourFactorsLeverWeights, value: number) => {
      onChange({ ...weights, [key]: value });
    },
    [weights, onChange],
  );

  return (
    <div className="four-factors">
      {/* Column headers */}
      <div className="four-factors__grid-header">
        <span className="four-factors__col-label" />
        <span className="four-factors__col-label">Offense</span>
        <span className="four-factors__col-label">Defense</span>
      </div>

      {FACTOR_ROWS.map((row) => (
        <div key={row.label} className="four-factors__row">
          <div className="four-factors__row-label">
            <span className="four-factors__factor-name">{row.label}</span>
            <span className="four-factors__factor-desc">{row.description}</span>
          </div>
          <div className="four-factors__slider-cell">
            <LeverSlider
              label=""
              description=""
              value={weights[row.offenseKey]}
              onChange={(v) => handleChange(row.offenseKey, v)}
              min={0}
              max={2}
              step={0.05}
            />
          </div>
          <div className="four-factors__slider-cell">
            <LeverSlider
              label=""
              description=""
              value={weights[row.defenseKey]}
              onChange={(v) => handleChange(row.defenseKey, v)}
              min={0}
              max={2}
              step={0.05}
            />
          </div>
        </div>
      ))}

      <style jsx>{`
        .four-factors {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .four-factors__grid-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border-subtle);
          margin-bottom: 4px;
        }
        .four-factors__col-label {
          font-size: 0.6875rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .four-factors__row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          align-items: start;
          padding: 6px 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .four-factors__row:last-child {
          border-bottom: none;
        }
        .four-factors__row-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .four-factors__factor-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .four-factors__factor-desc {
          font-size: 0.6875rem;
          color: var(--text-muted);
          line-height: 1.3;
        }
        .four-factors__slider-cell {
          display: flex;
          align-items: center;
        }
      `}</style>
    </div>
  );
}
