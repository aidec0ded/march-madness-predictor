"use client";

import React, { useCallback } from "react";
import type { EngineConfig } from "@/types/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import { LeverSlider } from "@/components/levers/LeverSlider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeverTuningPanelProps {
  config: EngineConfig;
  onChange: (config: EngineConfig) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Lever slider panel for backtest configuration.
 *
 * Provides controls for the five key lever weights used in backtest evaluation:
 * experience, continuity, coach experience, tempo variance, and 3PT variance.
 * Includes a "Reset to Defaults" button. Isolated from bracket context so it
 * can be used independently in the backtest dashboard.
 */
export function LeverTuningPanel({ config, onChange }: LeverTuningPanelProps) {
  const updateLever = useCallback(
    (key: string, value: number) => {
      onChange({
        ...config,
        levers: {
          ...config.levers,
          [key]: value,
        },
      });
    },
    [config, onChange],
  );

  const handleReset = useCallback(() => {
    onChange({ ...DEFAULT_ENGINE_CONFIG });
  }, [onChange]);

  return (
    <div className="lever-tuning">
      <div className="lever-tuning__header">
        <h3 className="lever-tuning__title">LEVER CONFIGURATION</h3>
      </div>

      <div className="lever-tuning__body">
        <LeverSlider
          label="Roster Experience"
          description="Weight for minutes-weighted D-1 experience. Higher values favor experienced rosters in simulation."
          value={config.levers.experienceWeight}
          onChange={(v) => updateLever("experienceWeight", v)}
          min={0}
          max={2}
          step={0.05}
        />

        <div className="lever-tuning__divider" />

        <LeverSlider
          label="Minutes Continuity"
          description="Rotation continuity from the prior season. Teams with high returning-minutes benefit at higher weights."
          value={config.levers.continuityWeight}
          onChange={(v) => updateLever("continuityWeight", v)}
          min={0}
          max={2}
          step={0.05}
        />

        <div className="lever-tuning__divider" />

        <LeverSlider
          label="Coach Experience"
          description="Coach's prior NCAA tournament track record. Rewards coaches with deep historical runs."
          value={config.levers.coachExperienceWeight}
          onChange={(v) => updateLever("coachExperienceWeight", v)}
          min={0}
          max={2}
          step={0.05}
        />

        <div className="lever-tuning__divider" />

        <LeverSlider
          label="Opponent Adjustment"
          description="Weight for Evan Miya's opponent adjustment metric. Measures how well teams play up/down to competition level."
          value={config.levers.opponentAdjustWeight}
          onChange={(v) => updateLever("opponentAdjustWeight", v)}
          min={0}
          max={2}
          step={0.05}
        />

        <div className="lever-tuning__divider" />

        <LeverSlider
          label="Tempo Variance"
          description="How much pace differences compress or expand outcome distributions. Slower pace increases upset probability."
          value={config.levers.tempoVarianceWeight}
          onChange={(v) => updateLever("tempoVarianceWeight", v)}
          min={0}
          max={2}
          step={0.05}
        />

        <div className="lever-tuning__divider" />

        <LeverSlider
          label="3PT Variance"
          description="How much three-point shooting reliance affects distribution width. High 3PT rate widens outcome volatility."
          value={config.levers.threePtVarianceWeight}
          onChange={(v) => updateLever("threePtVarianceWeight", v)}
          min={0}
          max={2}
          step={0.05}
        />
      </div>

      <div className="lever-tuning__footer">
        <button
          type="button"
          className="lever-tuning__reset-btn"
          onClick={handleReset}
        >
          Reset to Defaults
        </button>
      </div>

      <style jsx>{`
        .lever-tuning {
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: 10px;
          overflow: hidden;
        }

        .lever-tuning__header {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
        }

        .lever-tuning__title {
          margin: 0;
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .lever-tuning__body {
          padding: 12px 20px 4px;
          display: flex;
          flex-direction: column;
        }

        .lever-tuning__divider {
          height: 1px;
          background: var(--border-secondary);
          margin: 4px 0;
        }

        .lever-tuning__footer {
          padding: 12px 20px 16px;
        }

        .lever-tuning__reset-btn {
          width: 100%;
          padding: 9px 16px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--danger);
          background: transparent;
          border: 1px solid var(--danger);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lever-tuning__reset-btn:hover {
          background: var(--danger);
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
