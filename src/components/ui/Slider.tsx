"use client";

import { useId, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SliderProps {
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment */
  step: number;
  /** Current value */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Optional label displayed above the slider */
  label?: string;
  /** Optional description displayed below the label */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Styled range input slider.
 *
 * Uses CSS variables from the app's design system:
 * - Track: --bg-elevated
 * - Fill: --accent-primary
 * - Label: --text-primary
 * - Description: --text-muted
 */
export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  label,
  description,
  className,
}: SliderProps) {
  const id = useId();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  // Calculate fill percentage for the track gradient
  const fillPercent = ((value - min) / (max - min)) * 100;

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor={id}
            className="text-xs font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {label}
          </label>
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {value}
          </span>
        </div>
      )}

      {description && (
        <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      )}

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-0
          [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--bg-primary)]
          [&::-moz-range-thumb]:w-3.5
          [&::-moz-range-thumb]:h-3.5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:shadow-[0_0_0_2px_var(--bg-primary)]"
        style={{
          background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${fillPercent}%, var(--bg-elevated) ${fillPercent}%, var(--bg-elevated) 100%)`,
          // Thumb color via custom property
          ["--tw-slider-thumb-bg" as string]: "var(--accent-primary)",
        }}
      />

      {/* Inline style for thumb background color since Tailwind arbitrary can be unreliable */}
      <style>{`
        #${CSS.escape(id)}::-webkit-slider-thumb {
          background-color: var(--accent-primary);
        }
        #${CSS.escape(id)}::-moz-range-thumb {
          background-color: var(--accent-primary);
        }
      `}</style>
    </div>
  );
}
