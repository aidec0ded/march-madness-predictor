"use client";

import React, { useCallback } from "react";
import { Slider } from "@/components/ui/Slider";
import styles from "./LeverSlider.module.css";

export interface LeverSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

/**
 * Individual lever control — displays a labeled slider with current value,
 * −/+ stepper buttons for precise adjustments, and a description.
 */
export function LeverSlider({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 2,
  step = 0.05,
  unit = "\u00d7",
}: LeverSliderProps) {
  const nudge = useCallback(
    (direction: -1 | 1) => {
      const raw = value + direction * step;
      // Round to step precision to avoid floating-point drift
      const decimals = (step.toString().split(".")[1] || "").length;
      const clamped = Math.min(max, Math.max(min, parseFloat(raw.toFixed(decimals))));
      onChange(clamped);
    },
    [value, step, min, max, onChange]
  );

  return (
    <div className={styles.slider}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>
          {value.toFixed(2)}
          {unit}
        </span>
      </div>
      <div className={styles.sliderRow}>
        <button
          type="button"
          className={styles.stepButton}
          onClick={() => nudge(-1)}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          title={`−${step}`}
        >
          −
        </button>
        <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
        <button
          type="button"
          className={styles.stepButton}
          onClick={() => nudge(1)}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          title={`+${step}`}
        >
          +
        </button>
      </div>
      <p className={styles.description}>{description}</p>
    </div>
  );
}
