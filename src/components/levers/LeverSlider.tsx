"use client";

import React from "react";
import { Slider } from "@/components/ui/Slider";

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
  unit = "×",
}: LeverSliderProps) {
  return (
    <div className="lever-slider">
      <div className="lever-slider__header">
        <span className="lever-slider__label">{label}</span>
        <span className="lever-slider__value">
          {value.toFixed(2)}
          {unit}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} />
      <p className="lever-slider__description">{description}</p>
      <style jsx>{`
        .lever-slider {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 8px 0;
        }
        .lever-slider__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lever-slider__label {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .lever-slider__value {
          font-size: 0.8125rem;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
          font-weight: 600;
          color: var(--accent-primary);
        }
        .lever-slider__description {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
