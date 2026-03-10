"use client";

import React, { useState, useCallback } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { useBracket } from "@/hooks/useBracket";
import { DEFAULT_GLOBAL_LEVERS } from "@/types/engine";
import type { GlobalLevers } from "@/types/engine";
import { CompositeWeightsControl } from "./CompositeWeightsControl";
import { FourFactorsControls } from "./FourFactorsControls";
import { LeverSlider } from "./LeverSlider";
import { VarianceControls } from "./VarianceControls";

export interface LeverPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Collapsible section with a chevron toggle indicator.
 */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  return (
    <div className="lever-section">
      <button
        type="button"
        className="lever-section__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="lever-section__title">{title}</span>
        <span
          className={`lever-section__chevron ${isExpanded ? "lever-section__chevron--open" : ""}`}
        >
          ▸
        </span>
      </button>
      {isExpanded && <div className="lever-section__content">{children}</div>}
      <style jsx>{`
        .lever-section {
          border-bottom: 1px solid var(--border-subtle);
        }
        .lever-section__toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 0;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-primary);
        }
        .lever-section__toggle:hover {
          color: var(--accent-primary);
        }
        .lever-section__title {
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .lever-section__chevron {
          font-size: 0.875rem;
          transition: transform 0.2s ease;
          color: var(--text-muted);
        }
        .lever-section__chevron--open {
          transform: rotate(90deg);
        }
        .lever-section__content {
          padding: 0 0 16px 0;
        }
      `}</style>
    </div>
  );
}

/**
 * Main lever panel — a side drawer containing all global lever controls.
 * Reads/writes state through BracketContext.
 */
export function LeverPanel({ isOpen, onClose }: LeverPanelProps) {
  const { state, dispatch } = useBracket();
  const { globalLevers } = state;

  const updateLevers = useCallback(
    (partial: Partial<GlobalLevers>) => {
      dispatch({ type: "SET_GLOBAL_LEVERS", levers: partial });
    },
    [dispatch],
  );

  const handleReset = useCallback(() => {
    dispatch({
      type: "SET_GLOBAL_LEVERS",
      levers: { ...DEFAULT_GLOBAL_LEVERS },
    });
  }, [dispatch]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Simulation Levers" width="420px">
      <div className="lever-panel">
        {/* Composite Weights — default open */}
        <Section title="Composite Weights" defaultOpen>
          <CompositeWeightsControl
            weights={globalLevers.compositeWeights}
            onChange={(compositeWeights) => updateLevers({ compositeWeights })}
          />
        </Section>

        {/* Four Factors — default collapsed */}
        <Section title="Four Factors">
          <FourFactorsControls
            weights={globalLevers.fourFactors}
            onChange={(fourFactors) => updateLevers({ fourFactors })}
          />
        </Section>

        {/* Experience & Coaching — default collapsed */}
        <Section title="Experience &amp; Coaching">
          <LeverSlider
            label="Roster Experience"
            description="Weight for KenPom minutes-weighted D-1 experience. Higher values favor experienced rosters."
            value={globalLevers.experienceWeight}
            onChange={(experienceWeight) => updateLevers({ experienceWeight })}
          />
          <LeverSlider
            label="Minutes Continuity"
            description="Weight for rotation continuity from prior season. Higher values favor teams with returning players."
            value={globalLevers.continuityWeight}
            onChange={(continuityWeight) => updateLevers({ continuityWeight })}
          />
          <LeverSlider
            label="Coach Tournament Experience"
            description="Weight for a coach's prior NCAA tournament track record. Higher values favor experienced coaches."
            value={globalLevers.coachExperienceWeight}
            onChange={(coachExperienceWeight) =>
              updateLevers({ coachExperienceWeight })
            }
          />
          <LeverSlider
            label="Opponent Adjustment"
            description="Weight for Evan Miya's opponent adjustment metric. Measures how well teams play up/down to competition level. Particularly relevant for high seeds in early rounds."
            value={globalLevers.opponentAdjustWeight}
            onChange={(opponentAdjustWeight) =>
              updateLevers({ opponentAdjustWeight })
            }
          />
        </Section>

        {/* Variance — default collapsed */}
        <Section title="Variance">
          <VarianceControls
            tempoWeight={globalLevers.tempoVarianceWeight}
            threePtWeight={globalLevers.threePtVarianceWeight}
            onTempoChange={(tempoVarianceWeight) =>
              updateLevers({ tempoVarianceWeight })
            }
            onThreePtChange={(threePtVarianceWeight) =>
              updateLevers({ threePtVarianceWeight })
            }
          />
        </Section>

        {/* Reset button */}
        <div className="lever-panel__footer">
          <button
            type="button"
            className="lever-panel__reset-btn"
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      <style jsx>{`
        .lever-panel {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .lever-panel__footer {
          padding: 20px 0 0;
        }
        .lever-panel__reset-btn {
          width: 100%;
          padding: 10px 16px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--accent-danger);
          background: transparent;
          border: 1px solid var(--accent-danger);
          border-radius: 6px;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease;
        }
        .lever-panel__reset-btn:hover {
          background: var(--accent-danger);
          color: #ffffff;
        }
      `}</style>
    </Drawer>
  );
}
