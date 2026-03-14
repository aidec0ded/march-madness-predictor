"use client";

import React, { useCallback } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useBracket } from "@/hooks/useBracket";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useMediaQuery, MOBILE_QUERY } from "@/hooks/useMediaQuery";
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
 * Main lever panel — a side drawer containing all global lever controls.
 * Reads/writes state through BracketContext.
 */
export function LeverPanel({ isOpen, onClose }: LeverPanelProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { state, dispatch } = useBracket();
  const { globalLevers } = state;

  const updateLevers = useDebouncedCallback(
    (partial: Partial<GlobalLevers>) => {
      dispatch({ type: "SET_GLOBAL_LEVERS", levers: partial });
    },
    150,
  );

  const handleReset = useCallback(() => {
    dispatch({
      type: "SET_GLOBAL_LEVERS",
      levers: { ...DEFAULT_GLOBAL_LEVERS },
    });
  }, [dispatch]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Simulation Levers" width={isMobile ? "100vw" : "420px"}>
      <div className="lever-panel">
        {/* Composite Weights — default open */}
        <CollapsibleSection title="Composite Weights" defaultOpen>
          <CompositeWeightsControl
            weights={globalLevers.compositeWeights}
            onChange={(compositeWeights) => updateLevers({ compositeWeights })}
          />
        </CollapsibleSection>

        {/* Four Factors — default collapsed */}
        <CollapsibleSection title="Four Factors">
          <FourFactorsControls
            weights={globalLevers.fourFactors}
            onChange={(fourFactors) => updateLevers({ fourFactors })}
          />
        </CollapsibleSection>

        {/* Experience & Coaching — default collapsed */}
        <CollapsibleSection title="Experience &amp; Coaching">
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
        </CollapsibleSection>

        {/* Location & Travel — default collapsed */}
        <CollapsibleSection title="Location &amp; Travel">
          <LeverSlider
            label="Site Proximity"
            description="Weight for campus-to-venue distance advantage. Teams playing closer to home get a boost. Auto-computed from tournament site data."
            value={globalLevers.siteProximityWeight}
            onChange={(siteProximityWeight) =>
              updateLevers({ siteProximityWeight })
            }
          />
        </CollapsibleSection>

        {/* Schedule & Luck — default collapsed */}
        <CollapsibleSection title="Schedule &amp; Luck">
          <LeverSlider
            label="Strength of Schedule"
            description="Extra credit for teams whose efficiency was earned against tougher opponents. Adjusted ratings already partially account for SoS."
            value={globalLevers.sosWeight}
            onChange={(sosWeight) => updateLevers({ sosWeight })}
          />
          <LeverSlider
            label="Luck Regression"
            description="Penalty for teams that overperformed their efficiency (won close games at unsustainable rates). Tournament play tends to regress these outcomes."
            value={globalLevers.luckRegressionWeight}
            onChange={(luckRegressionWeight) => updateLevers({ luckRegressionWeight })}
          />
        </CollapsibleSection>

        {/* Variance — default collapsed */}
        <CollapsibleSection title="Variance">
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
        </CollapsibleSection>

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
