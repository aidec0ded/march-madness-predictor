"use client";

/**
 * MatchupView — full-screen overlay "film room" for a specific matchup.
 *
 * Triggered by clicking any matchup in the bracket. Contains:
 * - Back button to close
 * - Team profile cards for both teams
 * - Side-by-side stat comparison
 * - Probability display with before/after overrides
 * - Monte Carlo distribution histogram
 * - AI-generated narrative analysis (Claude-powered)
 * - Per-matchup override controls
 *
 * Renders as a fixed full-screen overlay with a semi-transparent backdrop.
 * Closes on Escape key or clicking the back button.
 */

import { useEffect, useCallback, useRef, useMemo, useState } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useMatchupAnalysis } from "@/hooks/useMatchupAnalysis";
import { useContestStrategy } from "@/hooks/useContestStrategy";
import { getMatchupEdgeAnalysis } from "@/lib/game-theory/strategy";
import type { TournamentRound } from "@/types/team";
import { TeamProfileCard } from "@/components/matchup/TeamProfileCard";
import { StatComparison } from "@/components/matchup/StatComparison";
import { ProbabilityDisplay } from "@/components/matchup/ProbabilityDisplay";
import { DistributionChart } from "@/components/matchup/DistributionChart";
import { MatchupOverridePanel } from "@/components/matchup/MatchupOverridePanel";
import { OwnershipExplainer } from "@/components/matchup/OwnershipExplainer";
import { NarrativePanel } from "@/components/matchup/NarrativePanel";
import { parseGameId } from "@/lib/bracket-layout";
import { FONT_MONO } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @prop gameId - The unique game identifier to analyze */
/** @prop onClose - Callback to close the overlay */
interface MatchupViewProps {
  /** The unique game identifier to analyze */
  gameId: string;
  /** Callback to close the overlay */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Round display names
// ---------------------------------------------------------------------------

const ROUND_LABELS: Record<string, string> = {
  FF: "First Four",
  R64: "Round of 64",
  R32: "Round of 32",
  S16: "Sweet 16",
  E8: "Elite 8",
  F4: "Final Four",
  NCG: "National Championship",
};

/**
 * Maps a round to the next round, used for extracting path probabilities.
 */
const NEXT_ROUND: Record<string, TournamentRound | "champion"> = {
  FF: "R64",
  R64: "R32",
  R32: "S16",
  S16: "E8",
  E8: "F4",
  F4: "NCG",
  NCG: "champion",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchupView({ gameId, onClose }: MatchupViewProps) {
  const { state, dispatch } = useBracket();
  const { analysis, teamA, teamB, stats, venue } = useMatchupAnalysis(gameId);
  const {
    getEffectiveOwnership,
    hasOwnershipOverride,
    poolConfig,
  } = useContestStrategy();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Ownership edit mode
  const [isEditingOwnership, setIsEditingOwnership] = useState(false);
  const [editOwnershipA, setEditOwnershipA] = useState("");

  // Get current overrides for this game
  const overrides = state.matchupOverrides[gameId];
  const hasOwnOverride = hasOwnershipOverride(gameId);

  // Compute game-level ownership for this matchup (uses override if present)
  const ownership = useMemo(() => {
    if (!analysis || !teamA?.teamId || !teamB?.teamId) return null;
    const [ownA, ownB] = getEffectiveOwnership(
      gameId,
      teamA.teamId,
      teamB.teamId,
      analysis.round
    );
    return { a: ownA, b: ownB };
  }, [analysis, teamA?.teamId, teamB?.teamId, gameId, getEffectiveOwnership]);

  // Compute edge analysis when we have both ownership and win probability
  const edgeAnalysis = useMemo(() => {
    if (!analysis || !ownership) return null;
    return getMatchupEdgeAnalysis(
      analysis.probA,
      ownership.a,
      ownership.b,
      analysis.round,
      poolConfig
    );
  }, [analysis, ownership, poolConfig]);

  // Extract path probabilities from simulation result for both teams
  const { pathProbA, pathProbB } = useMemo(() => {
    if (!state.simulationResult || !analysis) {
      return { pathProbA: null, pathProbB: null };
    }
    const round = analysis.round;
    const nextRound = NEXT_ROUND[round];
    if (!nextRound) return { pathProbA: null, pathProbB: null };

    const getPath = (teamId: string | undefined): number | null => {
      if (!teamId) return null;
      const tr = state.simulationResult!.teamResults.find(
        (r) => r.teamId === teamId
      );
      if (!tr) return null;
      if (nextRound === "champion") return tr.championshipProbability;
      return tr.roundProbabilities[nextRound] ?? null;
    };

    return {
      pathProbA: getPath(teamA?.teamId),
      pathProbB: getPath(teamB?.teamId),
    };
  }, [state.simulationResult, analysis, teamA?.teamId, teamB?.teamId]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    // Store the previously focused element to restore on close
    previousFocusRef.current = document.activeElement as HTMLElement;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the close button when overlay opens
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";

      // Return focus to the element that triggered the overlay
      previousFocusRef.current?.focus();
    };
  }, [handleKeyDown]);

  const parsed = parseGameId(gameId);
  const roundLabel = ROUND_LABELS[parsed.round] ?? parsed.round;
  const regionLabel = parsed.region ?? "";

  return (
    <>
      {/* Backdrop */}
      <div
        className="matchup-view__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Overlay panel */}
      <div
        className="matchup-view"
        role="dialog"
        aria-modal="true"
        aria-label={`Matchup details: ${gameId}`}
      >
        {/* Header */}
        <header className="matchup-view__header">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="matchup-view__back"
            aria-label="Close matchup view"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 2L4 8l6 6" />
            </svg>
            Back to Bracket
          </button>

          <div className="matchup-view__title-block">
            <h2 className="matchup-view__title">
              {regionLabel ? `${regionLabel} — ` : ""}{roundLabel}
            </h2>
            {venue?.name && (
              <span className="matchup-view__venue">
                {venue.name}{venue.city ? ` \u2022 ${venue.city}, ${venue.state}` : ""}
              </span>
            )}
            <span className="matchup-view__game-id">{gameId}</span>
          </div>
        </header>

        {/* Content */}
        <div className="matchup-view__content">
          {(!teamA || !teamB) && (
            <div className="matchup-view__empty">
              <p>
                {!teamA && !teamB
                  ? "Both teams have not yet been determined for this matchup. Make picks in earlier rounds to unlock this view."
                  : "One team has not yet been determined. Complete the feeder matchup to see the full analysis."}
              </p>
            </div>
          )}

          {teamA && teamB && analysis && (
            <>
              {/* Probability Display */}
              <ProbabilityDisplay
                analysis={analysis}
                teamA={teamA}
                teamB={teamB}
                pathProbA={pathProbA}
                pathProbB={pathProbB}
              />

              {/* Public Ownership + Leverage Analysis */}
              {ownership && (
                <div className={`ownership-bar${hasOwnOverride ? " ownership-bar--overridden" : ""}`}>
                  <div className="ownership-bar__header">
                    <span className="ownership-bar__title">
                      Public Ownership
                      {hasOwnOverride && (
                        <span className="ownership-bar__badge">CUSTOM</span>
                      )}
                    </span>
                    <div className="ownership-bar__actions">
                      {!isEditingOwnership ? (
                        <button
                          type="button"
                          className="ownership-bar__edit-btn"
                          onClick={() => {
                            setEditOwnershipA(String(Math.round(ownership.a)));
                            setIsEditingOwnership(true);
                          }}
                        >
                          {hasOwnOverride ? "Edit" : "Override"}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="ownership-bar__save-btn"
                            onClick={() => {
                              const valA = Math.max(0, Math.min(100, Number(editOwnershipA) || 50));
                              dispatch({
                                type: "SET_OWNERSHIP_OVERRIDE",
                                gameId,
                                ownership: [valA, 100 - valA],
                              });
                              setIsEditingOwnership(false);
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="ownership-bar__cancel-btn"
                            onClick={() => setIsEditingOwnership(false)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {hasOwnOverride && !isEditingOwnership && (
                        <button
                          type="button"
                          className="ownership-bar__reset-btn"
                          onClick={() => {
                            dispatch({ type: "REMOVE_OWNERSHIP_OVERRIDE", gameId });
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ownership values — editable or display */}
                  {isEditingOwnership ? (
                    <div className="ownership-bar__edit-row">
                      <label className="ownership-bar__edit-label">
                        {teamA.team.shortName}
                        <div className="ownership-bar__input-wrap">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="ownership-bar__input"
                            value={editOwnershipA}
                            onChange={(e) => setEditOwnershipA(e.target.value)}
                            autoFocus
                          />
                          <span className="ownership-bar__pct">%</span>
                        </div>
                      </label>
                      <span className="ownership-bar__edit-vs">vs</span>
                      <label className="ownership-bar__edit-label ownership-bar__edit-label--right">
                        {teamB.team.shortName}
                        <div className="ownership-bar__input-wrap">
                          <input
                            type="number"
                            className="ownership-bar__input ownership-bar__input--readonly"
                            value={Math.max(0, 100 - (Number(editOwnershipA) || 0))}
                            readOnly
                            tabIndex={-1}
                          />
                          <span className="ownership-bar__pct">%</span>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="ownership-bar__values">
                      <span
                        className="ownership-bar__team"
                        style={{
                          color: ownership.a >= 60
                            ? "var(--accent-warning)"
                            : ownership.a < 30
                              ? "var(--accent-success)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {teamA.team.shortName}{" "}
                        <strong>{Math.round(ownership.a)}%</strong>
                      </span>
                      <span
                        className="ownership-bar__team"
                        style={{
                          color: ownership.b >= 60
                            ? "var(--accent-warning)"
                            : ownership.b < 30
                              ? "var(--accent-success)"
                              : "var(--text-secondary)",
                        }}
                      >
                        <strong>{Math.round(ownership.b)}%</strong>{" "}
                        {teamB.team.shortName}
                      </span>
                    </div>
                  )}

                  <div className="ownership-bar__track">
                    <div
                      className="ownership-bar__fill-a"
                      style={{ width: `${ownership.a}%` }}
                    />
                    <div
                      className="ownership-bar__fill-b"
                      style={{ width: `${ownership.b}%` }}
                    />
                  </div>

                  {/* Leverage Scores */}
                  {edgeAnalysis && (
                    <div className="leverage-row">
                      <div className="leverage-row__item">
                        <span className="leverage-row__label">Leverage</span>
                        <span
                          className={`leverage-row__score${
                            edgeAnalysis.leverageA >= (edgeAnalysis.effectiveThreshold ?? 1.3)
                              ? " leverage-row__score--high"
                              : edgeAnalysis.leverageA <= 0.7
                                ? " leverage-row__score--low"
                                : ""
                          }`}
                        >
                          {edgeAnalysis.leverageA.toFixed(2)}×
                        </span>
                      </div>
                      <div className="leverage-row__divider" />
                      <div className="leverage-row__item leverage-row__item--right">
                        <span className="leverage-row__label">Leverage</span>
                        <span
                          className={`leverage-row__score${
                            edgeAnalysis.leverageB >= (edgeAnalysis.effectiveThreshold ?? 1.3)
                              ? " leverage-row__score--high"
                              : edgeAnalysis.leverageB <= 0.7
                                ? " leverage-row__score--low"
                                : ""
                          }`}
                        >
                          {edgeAnalysis.leverageB.toFixed(2)}×
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Edge Indicator */}
                  {edgeAnalysis?.isActionable && edgeAnalysis.edgeLabel && (
                    <div
                      className={`edge-callout${
                        edgeAnalysis.edgeLabel === "Strong Edge"
                          ? " edge-callout--strong"
                          : ""
                      }`}
                    >
                      <div className="edge-callout__header">
                        <span className="edge-callout__icon">⚡</span>
                        <span className="edge-callout__label">
                          {edgeAnalysis.edgeLabel}:{" "}
                          {edgeAnalysis.leverageTeamId === "A"
                            ? teamA.team.shortName
                            : teamB.team.shortName}
                        </span>
                      </div>
                      {edgeAnalysis.edgeDescription && (
                        <p className="edge-callout__desc">
                          {edgeAnalysis.edgeDescription
                            .replace("Team A", teamA.team.shortName)
                            .replace("Team B", teamB.team.shortName)}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="ownership-bar__note">
                    {hasOwnOverride
                      ? "Using your custom ownership values. Leverage = winProb ÷ ownership — values above 1.0× indicate contrarian value."
                      : "Estimated % of public brackets picking each team. Leverage = winProb ÷ ownership — values above 1.0× indicate contrarian value."}
                  </p>
                </div>
              )}

              {/* Team Profile Cards side-by-side */}
              <div className="matchup-view__profiles">
                <TeamProfileCard team={teamA} side="A" />
                <TeamProfileCard team={teamB} side="B" />
              </div>

              {/* Stat Comparison */}
              <StatComparison stats={stats} teamA={teamA} teamB={teamB} />

              {/* Distribution Chart */}
              <DistributionChart
                bins={analysis.distribution}
                teamA={teamA}
                teamB={teamB}
              />

              {/* AI Narrative Analysis */}
              <NarrativePanel
                analysis={analysis}
                teamA={teamA}
                teamB={teamB}
              />

              {/* Override Panel */}
              <MatchupOverridePanel
                gameId={gameId}
                teamA={teamA}
                teamB={teamB}
                overrides={overrides}
              />

              {/* Ownership Methodology Explainer */}
              <OwnershipExplainer />
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .matchup-view__backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          background-color: rgba(0, 0, 0, 0.7);
          animation: fade-in 0.2s ease;
        }
        .matchup-view {
          position: fixed;
          inset: 0;
          z-index: 51;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-primary);
          overflow-y: auto;
          animation: slide-up 0.25s ease;
        }
        .matchup-view__header {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px 24px;
          background-color: var(--bg-primary);
          border-bottom: 1px solid var(--border-subtle);
        }
        .matchup-view__back {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-secondary);
          background: none;
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .matchup-view__back:hover {
          color: var(--text-primary);
          border-color: var(--accent-primary);
        }
        .matchup-view__title-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .matchup-view__title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .matchup-view__venue {
          font-size: 0.75rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .matchup-view__game-id {
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-family: ${FONT_MONO};
        }
        .matchup-view__content {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px 24px 40px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }
        .matchup-view__profiles {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .matchup-view__empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          padding: 24px;
          text-align: center;
        }
        .matchup-view__empty p {
          color: var(--text-muted);
          font-size: 0.875rem;
          max-width: 400px;
          line-height: 1.5;
        }
        .ownership-bar {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 8px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          transition: border-color 0.2s ease;
        }
        .ownership-bar--overridden {
          border-color: var(--accent-primary);
          border-style: dashed;
        }
        .ownership-bar__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ownership-bar__title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ownership-bar__badge {
          font-size: 0.5625rem;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 3px;
          background-color: var(--accent-primary);
          color: #ffffff;
          letter-spacing: 0.08em;
        }
        .ownership-bar__actions {
          display: flex;
          gap: 6px;
        }
        .ownership-bar__edit-btn,
        .ownership-bar__save-btn,
        .ownership-bar__cancel-btn,
        .ownership-bar__reset-btn {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid var(--border-subtle);
          background: none;
          color: var(--text-secondary);
        }
        .ownership-bar__edit-btn:hover,
        .ownership-bar__reset-btn:hover,
        .ownership-bar__cancel-btn:hover {
          color: var(--text-primary);
          border-color: var(--accent-primary);
        }
        .ownership-bar__save-btn {
          background-color: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #ffffff;
        }
        .ownership-bar__save-btn:hover {
          opacity: 0.85;
        }
        .ownership-bar__reset-btn {
          color: var(--text-muted);
          border-color: transparent;
        }
        .ownership-bar__edit-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .ownership-bar__edit-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          flex: 1;
        }
        .ownership-bar__edit-label--right {
          text-align: right;
          align-items: flex-end;
        }
        .ownership-bar__input-wrap {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .ownership-bar__input {
          width: 56px;
          padding: 4px 6px;
          font-size: 0.875rem;
          font-weight: 700;
          font-family: ${FONT_MONO};
          background-color: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 4px;
          color: var(--text-primary);
          text-align: center;
        }
        .ownership-bar__input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 2px rgba(var(--accent-primary-rgb, 59, 130, 246), 0.2);
        }
        .ownership-bar__input--readonly {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ownership-bar__pct {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          font-family: ${FONT_MONO};
        }
        .ownership-bar__edit-vs {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          padding-top: 16px;
        }
        .ownership-bar__values {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .ownership-bar__team {
          font-size: 0.8125rem;
          font-weight: 500;
          font-family: ${FONT_MONO};
        }
        .ownership-bar__team strong {
          font-weight: 800;
          font-size: 0.9375rem;
        }
        .ownership-bar__track {
          display: flex;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          background-color: var(--bg-elevated);
          gap: 2px;
        }
        .ownership-bar__fill-a {
          height: 100%;
          border-radius: 4px;
          background-color: var(--accent-primary);
          opacity: 0.7;
          transition: width 0.3s ease;
        }
        .ownership-bar__fill-b {
          height: 100%;
          border-radius: 4px;
          background-color: var(--accent-danger);
          opacity: 0.7;
          transition: width 0.3s ease;
        }

        /* Leverage Row */
        .leverage-row {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 6px 0 0;
        }
        .leverage-row__item {
          flex: 1;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .leverage-row__item--right {
          justify-content: flex-end;
        }
        .leverage-row__label {
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .leverage-row__score {
          font-size: 0.875rem;
          font-weight: 800;
          font-family: ${FONT_MONO};
          color: var(--text-secondary);
        }
        .leverage-row__score--high {
          color: var(--accent-success);
        }
        .leverage-row__score--low {
          color: var(--accent-warning);
        }
        .leverage-row__divider {
          width: 1px;
          height: 20px;
          background-color: var(--border-subtle);
          margin: 0 12px;
          flex-shrink: 0;
        }

        /* Edge Callout */
        .edge-callout {
          padding: 10px 12px;
          border-radius: 6px;
          background-color: rgba(var(--accent-success-rgb, 34, 197, 94), 0.08);
          border: 1px solid rgba(var(--accent-success-rgb, 34, 197, 94), 0.25);
        }
        .edge-callout--strong {
          background-color: rgba(var(--accent-success-rgb, 34, 197, 94), 0.12);
          border-color: rgba(var(--accent-success-rgb, 34, 197, 94), 0.4);
        }
        .edge-callout__header {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .edge-callout__icon {
          font-size: 0.875rem;
        }
        .edge-callout__label {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--accent-success);
        }
        .edge-callout__desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 4px 0 0;
          line-height: 1.5;
        }

        .ownership-bar__note {
          font-size: 0.6875rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin: 0;
          text-align: center;
          font-style: italic;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
