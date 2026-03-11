"use client";

/**
 * MatchupOverridePanel — per-matchup controls for injury, site proximity,
 * recent form, and rest adjustments.
 *
 * Dispatches SET_MATCHUP_OVERRIDE to BracketContext when values change.
 * All slider values are inherited from the current overrides or default to 0/neutral.
 */

import { useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { Slider } from "@/components/ui/Slider";
import type { TeamSeason } from "@/types/team";
import type { MatchupOverrides } from "@/types/engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @prop gameId - Game identifier for dispatching overrides */
/** @prop teamA - Team A data */
/** @prop teamB - Team B data */
/** @prop overrides - Current per-matchup overrides (undefined if none) */
interface MatchupOverridePanelProps {
  /** Game identifier for dispatching overrides */
  gameId: string;
  /** Team A data */
  teamA: TeamSeason;
  /** Team B data */
  teamB: TeamSeason;
  /** Current per-matchup overrides (undefined if none) */
  overrides?: MatchupOverrides;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchupOverridePanel({
  gameId,
  teamA,
  teamB,
  overrides,
}: MatchupOverridePanelProps) {
  const { dispatch } = useBracket();

  const updateOverride = useCallback(
    (patch: Partial<MatchupOverrides>) => {
      const newOverrides: MatchupOverrides = {
        ...overrides,
        ...patch,
      };
      dispatch({
        type: "SET_MATCHUP_OVERRIDE",
        gameId,
        overrides: newOverrides,
      });
    },
    [dispatch, gameId, overrides]
  );

  const clearOverrides = useCallback(() => {
    dispatch({ type: "REMOVE_MATCHUP_OVERRIDE", gameId });
  }, [dispatch, gameId]);

  // Current values with defaults
  const injuryA = overrides?.injuryAdjustmentA ?? 0;
  const injuryB = overrides?.injuryAdjustmentB ?? 0;
  const formA = overrides?.recentFormA ?? 0;
  const formB = overrides?.recentFormB ?? 0;
  const restA = overrides?.restAdjustmentA ?? 0;
  const restB = overrides?.restAdjustmentB ?? 0;

  const hasOverrides = overrides !== undefined;

  return (
    <div className="override-panel">
      <div className="override-panel__header">
        <h4 className="override-panel__title">Per-Matchup Overrides</h4>
        {hasOverrides && (
          <button
            type="button"
            onClick={clearOverrides}
            className="override-panel__clear"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Injury Adjustments */}
      <OverrideSection
        title="Injury / Availability"
        description="Downward efficiency adjustment for roster unavailability. More negative = bigger impact."
      >
        <Slider
          label={`${teamA.team.shortName} Injury`}
          min={-5}
          max={0}
          step={0.5}
          value={injuryA}
          onChange={(v) => updateOverride({ injuryAdjustmentA: v })}
        />
        <Slider
          label={`${teamB.team.shortName} Injury`}
          min={-5}
          max={0}
          step={0.5}
          value={injuryB}
          onChange={(v) => updateOverride({ injuryAdjustmentB: v })}
        />
      </OverrideSection>

      {/* Recent Form */}
      <OverrideSection
        title="Recent Form / Momentum"
        description="Adjustment for teams trending up or down relative to season-long ratings. Positive = trending up."
      >
        <Slider
          label={`${teamA.team.shortName} Form`}
          min={-5}
          max={5}
          step={0.5}
          value={formA}
          onChange={(v) => updateOverride({ recentFormA: v })}
        />
        <Slider
          label={`${teamB.team.shortName} Form`}
          min={-5}
          max={5}
          step={0.5}
          value={formB}
          onChange={(v) => updateOverride({ recentFormB: v })}
        />
      </OverrideSection>

      {/* Rest / Schedule Density */}
      <OverrideSection
        title="Rest / Schedule Density"
        description="Adjustment for days of rest. Positive = well-rested, negative = fatigued from deep conference tournament run."
      >
        <Slider
          label={`${teamA.team.shortName} Rest`}
          min={-3}
          max={3}
          step={0.5}
          value={restA}
          onChange={(v) => updateOverride({ restAdjustmentA: v })}
        />
        <Slider
          label={`${teamB.team.shortName} Rest`}
          min={-3}
          max={3}
          step={0.5}
          value={restB}
          onChange={(v) => updateOverride({ restAdjustmentB: v })}
        />
      </OverrideSection>

      {/* Bench Depth — lever weight override (default 0 globally) */}
      <OverrideSection
        title="Bench Depth"
        description="Activate to factor in bench depth advantage. Deeper benches handle foul trouble and second-half fatigue. Useful when a key player is in foul trouble."
      >
        <Slider
          label="Bench Depth Weight"
          min={0}
          max={2}
          step={0.1}
          value={overrides?.leverOverrides?.benchDepthWeight ?? 0}
          onChange={(v) =>
            updateOverride({
              leverOverrides: {
                ...overrides?.leverOverrides,
                benchDepthWeight: v,
              },
            })
          }
        />
      </OverrideSection>

      {/* Pace Adjustment — lever weight override (default 0 globally) */}
      <OverrideSection
        title="Pace Adjustment"
        description="Activate to factor in how each team adapts to pace mismatches. Based on Evan Miya's pace adjustment metric."
      >
        <Slider
          label="Pace Adjust Weight"
          min={0}
          max={2}
          step={0.1}
          value={overrides?.leverOverrides?.paceAdjustWeight ?? 0}
          onChange={(v) =>
            updateOverride({
              leverOverrides: {
                ...overrides?.leverOverrides,
                paceAdjustWeight: v,
              },
            })
          }
        />
      </OverrideSection>

      {/* 2-Foul Participation — manual entry, narrative context only */}
      <OverrideSection
        title="2-Foul Participation"
        description="Rate at which coach keeps players with 2 fouls in the game (0-1). Narrative context only — does not affect probability. Find on kenpom.com under team page."
      >
        <Slider
          label={`${teamA.team.shortName} 2FP`}
          min={0}
          max={1}
          step={0.01}
          value={overrides?.twoFoulParticipationA ?? 0}
          onChange={(v) => updateOverride({ twoFoulParticipationA: v })}
        />
        <Slider
          label={`${teamB.team.shortName} 2FP`}
          min={0}
          max={1}
          step={0.01}
          value={overrides?.twoFoulParticipationB ?? 0}
          onChange={(v) => updateOverride({ twoFoulParticipationB: v })}
        />
      </OverrideSection>

      <style jsx>{`
        .override-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          border-radius: 8px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
        }
        .override-panel__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .override-panel__title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .override-panel__clear {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--accent-danger);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: opacity 0.15s ease;
        }
        .override-panel__clear:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OverrideSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="override-section">
      <div className="override-section__header">
        <span className="override-section__title">{title}</span>
        <p className="override-section__desc">{description}</p>
      </div>
      <div className="override-section__controls">{children}</div>
      <style jsx>{`
        .override-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border-subtle);
        }
        .override-section__header {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .override-section__title {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
        }
        .override-section__desc {
          font-size: 0.6875rem;
          color: var(--text-muted);
          margin: 0;
          line-height: 1.4;
        }
        .override-section__controls {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
      `}</style>
    </div>
  );
}

