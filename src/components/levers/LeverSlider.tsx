"use client";

import React from "react";
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
 * Individual lever control — displays a labeled slider with current value
 * and a description of what the lever does.
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
  return (
    <div className={styles.slider}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>
          {value.toFixed(2)}
          {unit}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
      <p className={styles.description}>{description}</p>
    </div>
  );
}
