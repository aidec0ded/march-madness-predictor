"use client";

/**
 * ProbabilityDisplay — shows before/after probability, point spread,
 * and key breakdown items from the probability calculation.
 *
 * Renders a compact summary panel with:
 * - Large probability numbers for each team
 * - Before/after comparison when overrides are applied
 * - Point spread estimate
 * - Breakdown table of probability components
 */

import { memo } from "react";
import type { TeamSeason } from "@/types/team";
import type { MatchupAnalysis, ProbabilityBreakdownDisplay } from "@/types/matchup-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @prop analysis - Full matchup analysis data */
/** @prop teamA - Team A data */
/** @prop teamB - Team B data */
interface ProbabilityDisplayProps {
  /** Full matchup analysis data */
  analysis: MatchupAnalysis;
  /** Team A data */
  teamA: TeamSeason;
  /** Team B data */
  teamB: TeamSeason;
  /** Path probability for team A — P(advancing past this round) from simulation (optional) */
  pathProbA?: number | null;
  /** Path probability for team B — P(advancing past this round) from simulation (optional) */
  pathProbB?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a probability as a percentage string */
function fmtProb(p: number): string {
  return (p * 100).toFixed(1) + "%";
}

/** Formats a breakdown value based on its format type */
function fmtBreakdown(item: ProbabilityBreakdownDisplay): string {
  switch (item.format) {
    case "probability":
      return fmtProb(item.value);
    case "adjustment":
      return (item.value >= 0 ? "+" : "") + item.value.toFixed(2);
    case "multiplier":
      return item.value.toFixed(3) + "x";
  }
}

/** Returns the color for an adjustment value */
function getAdjustmentColor(value: number, format: string): string {
  if (format === "probability" || format === "multiplier") return "var(--text-primary)";
  if (value > 0.01) return "var(--accent-success)";
  if (value < -0.01) return "var(--accent-danger)";
  return "var(--text-muted)";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ProbabilityDisplay = memo(function ProbabilityDisplay({
  analysis,
  teamA,
  teamB,
  pathProbA,
  pathProbB,
}: ProbabilityDisplayProps) {
  const hasOverrides = analysis.probA !== analysis.baseProbA;
  const spreadStr =
    analysis.spread < 0
      ? `${teamA.team.shortName} -${Math.abs(analysis.spread).toFixed(1)}`
      : analysis.spread > 0
        ? `${teamB.team.shortName} -${Math.abs(analysis.spread).toFixed(1)}`
        : "Pick'em";

  return (
    <div className="prob-display">
      {/* Main probabilities */}
      <div className="prob-display__main">
        <ProbColumn
          teamName={teamA.team.shortName}
          prob={analysis.probA}
          baseProb={hasOverrides ? analysis.baseProbA : null}
          color="var(--accent-primary)"
        />

        <div className="prob-display__center">
          <span className="prob-display__vs">VS</span>
          <span className="prob-display__spread">{spreadStr}</span>
        </div>

        <ProbColumn
          teamName={teamB.team.shortName}
          prob={analysis.probB}
          baseProb={hasOverrides ? analysis.baseProbB : null}
          color="var(--accent-danger)"
        />
      </div>

      {/* Probability bar */}
      <div className="prob-display__bar-container">
        <div
          className="prob-display__bar-a"
          style={{
            width: `${analysis.probA * 100}%`,
            backgroundColor: "var(--accent-primary)",
          }}
        />
        <div
          className="prob-display__bar-b"
          style={{
            width: `${analysis.probB * 100}%`,
            backgroundColor: "var(--accent-danger)",
          }}
        />
      </div>

      {/* Simulation path probability (or placeholder prompt) */}
      {(pathProbA != null || pathProbB != null) ? (
        <div className="prob-display__path-info">
          <span className="prob-display__path-label">Simulation path to advance:</span>
          <div className="prob-display__path-values">
            {pathProbA != null && (
              <span className="prob-display__path-value" style={{ color: "var(--accent-primary)" }}>
                {teamA.team.shortName} {fmtProb(pathProbA)}
              </span>
            )}
            {pathProbA != null && pathProbB != null && (
              <span className="prob-display__path-sep">|</span>
            )}
            {pathProbB != null && (
              <span className="prob-display__path-value" style={{ color: "var(--accent-danger)" }}>
                {teamB.team.shortName} {fmtProb(pathProbB)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="prob-display__path-prompt">
          Run simulation to see path probabilities — how likely each team is
          to reach this round considering the full bracket.
        </div>
      )}

      {/* Breakdown table */}
      <div className="prob-display__breakdown">
        <div className="prob-display__breakdown-title">Probability Breakdown</div>
        {analysis.breakdown.map((item) => (
          <div key={item.label} className="prob-display__breakdown-row">
            <span className="prob-display__breakdown-label">{item.label}</span>
            <span
              className="prob-display__breakdown-value"
              style={{ color: getAdjustmentColor(item.value, item.format) }}
            >
              {fmtBreakdown(item)}
            </span>
          </div>
        ))}
        <div className="prob-display__breakdown-row prob-display__breakdown-row--final">
          <span className="prob-display__breakdown-label">Final (Team A)</span>
          <span
            className="prob-display__breakdown-value"
            style={{ color: "var(--accent-primary)" }}
          >
            {fmtProb(analysis.probA)}
          </span>
        </div>
      </div>

      <style jsx>{`
        .prob-display {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          border-radius: 8px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
        }
        .prob-display__main {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
        }
        .prob-display__center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .prob-display__vs {
          font-size: 0.875rem;
          font-weight: 800;
          color: var(--text-muted);
        }
        .prob-display__spread {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          white-space: nowrap;
        }
        .prob-display__bar-container {
          display: flex;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          background-color: var(--bg-elevated);
          gap: 2px;
        }
        .prob-display__bar-a,
        .prob-display__bar-b {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .prob-display__path-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border-radius: 6px;
          background-color: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
        }
        .prob-display__path-label {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }
        .prob-display__path-values {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .prob-display__path-value {
          font-size: 0.8125rem;
          font-weight: 700;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
        }
        .prob-display__path-sep {
          color: var(--text-muted);
          font-size: 0.75rem;
        }
        .prob-display__path-prompt {
          text-align: center;
          padding: 8px 12px;
          border-radius: 6px;
          background-color: var(--bg-elevated);
          border: 1px dashed var(--border-subtle);
          color: var(--text-muted);
          font-size: 0.75rem;
          font-style: italic;
          line-height: 1.4;
        }
        .prob-display__breakdown {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .prob-display__breakdown-title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .prob-display__breakdown-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 2px 0;
        }
        .prob-display__breakdown-row--final {
          border-top: 1px solid var(--border-subtle);
          padding-top: 6px;
          margin-top: 4px;
        }
        .prob-display__breakdown-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .prob-display__breakdown-value {
          font-size: 0.75rem;
          font-weight: 600;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
        }
      `}</style>
    </div>
  );
});

// ---------------------------------------------------------------------------
// ProbColumn sub-component
// ---------------------------------------------------------------------------

function ProbColumn({
  teamName,
  prob,
  baseProb,
  color,
}: {
  teamName: string;
  prob: number;
  baseProb: number | null;
  color: string;
}) {
  return (
    <div className="prob-col">
      <span className="prob-col__team" style={{ color }}>
        {teamName}
      </span>
      <span className="prob-col__value" style={{ color }}>
        {(prob * 100).toFixed(1)}%
      </span>
      {baseProb !== null && (
        <span className="prob-col__base">
          was {(baseProb * 100).toFixed(1)}%
        </span>
      )}
      <style jsx>{`
        .prob-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .prob-col__team {
          font-size: 0.8125rem;
          font-weight: 700;
        }
        .prob-col__value {
          font-size: 2rem;
          font-weight: 800;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
          line-height: 1;
        }
        .prob-col__base {
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
