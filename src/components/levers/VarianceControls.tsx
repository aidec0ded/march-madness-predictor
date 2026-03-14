"use client";

import React from "react";
import { LeverSlider } from "./LeverSlider";
import styles from "./VarianceControls.module.css";

export interface VarianceControlsProps {
  tempoWeight: number;
  threePtWeight: number;
  onTempoChange: (value: number) => void;
  onThreePtChange: (value: number) => void;
}

/**
 * Two variance-adjusting lever sliders with inline explanations.
 * These control how tempo and 3-point rate affect the width of
 * the Monte Carlo outcome distribution.
 */
export function VarianceControls({
  tempoWeight,
  threePtWeight,
  onTempoChange,
  onThreePtChange,
}: VarianceControlsProps) {
  return (
    <div className={styles.container}>
      <LeverSlider
        label="Tempo Variance Weight"
        description="Slower pace compresses outcomes, increasing upset probability for mismatched teams."
        value={tempoWeight}
        onChange={onTempoChange}
        min={0}
        max={2}
        step={0.05}
      />
      <LeverSlider
        label="3PT Variance Weight"
        description="High-volume 3-point teams introduce boom/bust variance with wider outcome distributions."
        value={threePtWeight}
        onChange={onThreePtChange}
        min={0}
        max={2}
        step={0.05}
      />
    </div>
  );
}
