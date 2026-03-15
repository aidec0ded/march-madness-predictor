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
import styles from "./LeverPanel.module.css";

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
      <div className={styles.panel}>
        {/* ── Tier 1: Backtested Levers ── */}
        <div className={styles.tierHeader}>
          <span className={styles.tierLabel}>Backtested</span>
          <span className={styles.tierNote}>Empirically validated via historical tournaments</span>
        </div>

        <CollapsibleSection title="Composite Weights" defaultOpen>
          <CompositeWeightsControl
            weights={globalLevers.compositeWeights}
            onChange={(compositeWeights) => updateLevers({ compositeWeights })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Four Factors">
          <FourFactorsControls
            weights={globalLevers.fourFactors}
            onChange={(fourFactors) => updateLevers({ fourFactors })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Coaching">
          <LeverSlider
            label="Coach Tournament Experience"
            description="Weight for a coach's prior NCAA tournament track record. Higher values favor experienced coaches."
            value={globalLevers.coachExperienceWeight}
            onChange={(coachExperienceWeight) =>
              updateLevers({ coachExperienceWeight })
            }
          />
        </CollapsibleSection>

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

        {/* ── Tier 2: Supplemental Levers ── */}
        <div className={styles.tierHeader}>
          <span className={styles.tierLabel}>Supplemental</span>
          <span className={styles.tierNote}>Not backtestable — based on user judgment</span>
        </div>

        <CollapsibleSection title="Experience &amp; Continuity" badge="Off by default">
          <LeverSlider
            label="Roster Experience"
            description="Weight for KenPom minutes-weighted D-1 experience. Higher values favor experienced rosters. Not available in historical dataset for backtesting."
            value={globalLevers.experienceWeight}
            onChange={(experienceWeight) => updateLevers({ experienceWeight })}
          />
          <LeverSlider
            label="Minutes Continuity"
            description="Weight for rotation continuity from prior season. Higher values favor teams with returning players. Not available in historical dataset for backtesting."
            value={globalLevers.continuityWeight}
            onChange={(continuityWeight) => updateLevers({ continuityWeight })}
          />
          <LeverSlider
            label="Opponent Adjustment"
            description="Weight for Evan Miya's opponent adjustment metric. Measures how well teams play up/down to competition level. Not available in historical dataset for backtesting."
            value={globalLevers.opponentAdjustWeight}
            onChange={(opponentAdjustWeight) =>
              updateLevers({ opponentAdjustWeight })
            }
          />
        </CollapsibleSection>

        <CollapsibleSection title="Schedule &amp; Luck" badge="Off by default">
          <LeverSlider
            label="Strength of Schedule"
            description="Extra credit for teams whose efficiency was earned against tougher opponents. Adjusted ratings already partially account for SoS. Not available in historical dataset for backtesting."
            value={globalLevers.sosWeight}
            onChange={(sosWeight) => updateLevers({ sosWeight })}
          />
          <LeverSlider
            label="Luck Regression"
            description="Penalty for teams that overperformed their efficiency (won close games at unsustainable rates). Not available in historical dataset for backtesting."
            value={globalLevers.luckRegressionWeight}
            onChange={(luckRegressionWeight) => updateLevers({ luckRegressionWeight })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Location &amp; Travel" badge="Off by default">
          <LeverSlider
            label="Site Proximity"
            description="Weight for campus-to-venue distance advantage. Teams playing closer to home get a boost. Historical venue data not loaded for backtesting."
            value={globalLevers.siteProximityWeight}
            onChange={(siteProximityWeight) =>
              updateLevers({ siteProximityWeight })
            }
          />
        </CollapsibleSection>

        {/* Reset button */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.resetButton}
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </Drawer>
  );
}
