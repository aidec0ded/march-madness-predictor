"use client";

import React, { useCallback } from "react";
import type { EngineConfig } from "@/types/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { CompositeWeights, FourFactorsLeverWeights } from "@/types/engine";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { CompositeWeightsControl } from "@/components/levers/CompositeWeightsControl";
import { FourFactorsControls } from "@/components/levers/FourFactorsControls";
import { LeverSlider } from "@/components/levers/LeverSlider";
import { VarianceControls } from "@/components/levers/VarianceControls";

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
 * Exposes only Tier 1 (backtested) levers — the ones with supporting data
 * in the historical dataset (2008-2024). Tier 2 (supplemental) levers are
 * excluded because their underlying data fields (KenPom experience,
 * continuity, SoS, luck; Evan Miya opponent adjustment; tournament site
 * coordinates) are NULL for historical seasons.
 *
 * Tier 1 levers (available here):
 * - Composite Weights (Torvik data available for all seasons)
 * - Four Factors (Torvik data available for all seasons)
 * - Coach Experience (Kaggle historical data available)
 * - Tempo & 3PT Variance (Torvik data available for all seasons)
 *
 * Uses the same sub-components as the main bracket LeverPanel for
 * UI consistency. Isolated from bracket context so lever tuning during
 * backtesting does not affect the user's live bracket probabilities.
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

  const updateCompositeWeights = useCallback(
    (compositeWeights: CompositeWeights) => {
      onChange({
        ...config,
        levers: {
          ...config.levers,
          compositeWeights,
        },
      });
    },
    [config, onChange],
  );

  const updateFourFactors = useCallback(
    (fourFactors: FourFactorsLeverWeights) => {
      onChange({
        ...config,
        levers: {
          ...config.levers,
          fourFactors,
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
        {/* Composite Weights — default open */}
        <CollapsibleSection title="Composite Weights" defaultOpen>
          <CompositeWeightsControl
            weights={config.levers.compositeWeights}
            onChange={updateCompositeWeights}
          />
        </CollapsibleSection>

        {/* Four Factors — default collapsed */}
        <CollapsibleSection title="Four Factors">
          <FourFactorsControls
            weights={config.levers.fourFactors}
            onChange={updateFourFactors}
          />
        </CollapsibleSection>

        {/* Coaching — default collapsed */}
        <CollapsibleSection title="Coaching">
          <LeverSlider
            label="Coach Tournament Experience"
            description="Coach's prior NCAA tournament track record. Rewards coaches with deep historical runs."
            value={config.levers.coachExperienceWeight}
            onChange={(v) => updateLever("coachExperienceWeight", v)}
            min={0}
            max={2}
            step={0.05}
          />
        </CollapsibleSection>

        {/* Variance — default collapsed */}
        <CollapsibleSection title="Variance">
          <VarianceControls
            tempoWeight={config.levers.tempoVarianceWeight}
            threePtWeight={config.levers.threePtVarianceWeight}
            onTempoChange={(v) => updateLever("tempoVarianceWeight", v)}
            onThreePtChange={(v) => updateLever("threePtVarianceWeight", v)}
          />
        </CollapsibleSection>
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
          padding: 4px 20px 4px;
          display: flex;
          flex-direction: column;
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
