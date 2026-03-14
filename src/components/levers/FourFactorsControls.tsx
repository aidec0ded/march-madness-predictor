"use client";

import React, { useCallback } from "react";
import type { FourFactorsLeverWeights } from "@/types/engine";
import { LeverSlider } from "./LeverSlider";
import styles from "./FourFactorsControls.module.css";

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
    <div className={styles.container}>
      {/* Column headers */}
      <div className={styles.gridHeader}>
        <span className={styles.colLabel} />
        <span className={styles.colLabel}>Offense</span>
        <span className={styles.colLabel}>Defense</span>
      </div>

      {FACTOR_ROWS.map((row) => (
        <div key={row.label} className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.factorName}>{row.label}</span>
            <span className={styles.factorDesc}>{row.description}</span>
          </div>
          <div className={styles.sliderCell}>
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
          <div className={styles.sliderCell}>
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
    </div>
  );
}
