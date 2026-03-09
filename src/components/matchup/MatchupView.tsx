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

import { useEffect, useCallback, useRef } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useMatchupAnalysis } from "@/hooks/useMatchupAnalysis";
import { TeamProfileCard } from "@/components/matchup/TeamProfileCard";
import { StatComparison } from "@/components/matchup/StatComparison";
import { ProbabilityDisplay } from "@/components/matchup/ProbabilityDisplay";
import { DistributionChart } from "@/components/matchup/DistributionChart";
import { MatchupOverridePanel } from "@/components/matchup/MatchupOverridePanel";
import { NarrativePanel } from "@/components/matchup/NarrativePanel";
import { parseGameId } from "@/lib/bracket-layout";

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
  R64: "Round of 64",
  R32: "Round of 32",
  S16: "Sweet 16",
  E8: "Elite 8",
  F4: "Final Four",
  NCG: "National Championship",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchupView({ gameId, onClose }: MatchupViewProps) {
  const { state } = useBracket();
  const { analysis, teamA, teamB, stats } = useMatchupAnalysis(gameId);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Get current overrides for this game
  const overrides = state.matchupOverrides[gameId];

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
              />

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
        .matchup-view__game-id {
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
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
