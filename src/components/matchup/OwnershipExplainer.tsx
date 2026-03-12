"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Collapsible explainer panel documenting the 4 factors behind ownership estimates.
 *
 * Placed in the matchup view to give users context on what drives the "X% own"
 * badges they see throughout the bracket.
 */
export function OwnershipExplainer() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="ownership-explainer">
      <button
        type="button"
        className="ownership-explainer__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="ownership-explainer__icon">i</span>
        <span>How is ownership estimated?</span>
      </button>

      {isExpanded && (
        <div className="ownership-explainer__content">
          <FactorRow
            label="Seed Baseline"
            detail="1-seeds start ~98% owned in Round of 64; 16-seeds ~2%. Higher seeds are picked more often by the public regardless of actual team strength."
          />
          <FactorRow
            label="Round Decay"
            detail="Ownership drops each round (\u00d70.85 in R32, \u00d70.70 in Sweet 16, down to \u00d70.30 by the Championship). Fewer brackets pick any team to go deep."
          />
          <FactorRow
            label="Conference Profile"
            detail="Power conference teams (ACC, Big 12, Big East, Big Ten, SEC) get +4 percentage points. Strong mid-major conferences (WCC, AAC, MWC, A-10) get +1.5 pp."
          />
          <FactorRow
            label="Rating Strength"
            detail="Teams rated above their seed expectation get an ownership bump (up to +5 pp). Teams below expectation get reduced (down to -3 pp). This reflects how media coverage influences public picks."
          />
          <p className="ownership-explainer__footer">
            These are heuristic estimates of public bracket behavior, not
            predictions of who will win. Actual contest ownership may vary.
          </p>
        </div>
      )}

      <style jsx>{`
        .ownership-explainer {
          border-radius: 6px;
          background-color: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
        }
        .ownership-explainer__toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 8px 12px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          transition: color 0.15s ease;
        }
        .ownership-explainer__toggle:hover {
          color: var(--accent-primary);
        }
        .ownership-explainer__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: var(--accent-primary);
          color: #ffffff;
          font-size: 0.625rem;
          font-weight: 700;
          font-style: italic;
          flex-shrink: 0;
        }
        .ownership-explainer__content {
          padding: 0 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid var(--border-subtle);
        }
        .ownership-explainer__footer {
          font-size: 0.6875rem;
          color: var(--text-muted);
          font-style: italic;
          margin: 4px 0 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FactorRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="factor-row">
      <span className="factor-row__label">{label}</span>
      <p className="factor-row__detail">{detail}</p>
      <style jsx>{`
        .factor-row {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding-top: 8px;
        }
        .factor-row__label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .factor-row__detail {
          font-size: 0.6875rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
