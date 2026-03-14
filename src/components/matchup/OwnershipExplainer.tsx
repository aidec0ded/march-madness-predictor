"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Collapsible explainer panel documenting the factors behind ownership estimates.
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
            detail="Based on NCAA.com historical pick data. In a 1-vs-16 game, 98.5% of brackets pick the 1-seed. For a 5-vs-12 game, 64% pick the 5-seed. In later rounds, the split is determined proportionally from each seed's popularity score."
          />
          <FactorRow
            label="Conference Strength"
            detail="Power conference teams (ACC, Big 12, Big East, Big Ten, SEC) get +4 percentage points when facing a non-power conference opponent. This reflects the public's tendency to favor familiar programs."
          />
          <FactorRow
            label="Rating Strength"
            detail="Teams with a higher composite efficiency margin (KenPom/Torvik/Evan Miya) get +1 percentage point per 2 points of AdjEM advantage over their opponent."
          />
          <FactorRow
            label="Public Recognition"
            detail="Blue-blood programs (Duke, Kansas, Kentucky, North Carolina, Connecticut, UCLA) get +2 percentage points when facing a non-blue-blood opponent. These schools are historically over-picked by the public."
          />
          <FactorRow
            label="Chalk Multiplier"
            detail="In later rounds (R32 through Championship), the public picks more conservatively — the favorite's share is scaled upward slightly (×1.05 in R32 up to ×1.20 in Final Four/Championship)."
          />
          <p className="ownership-explainer__footer">
            Ownership always sums to 100% within each matchup. These are
            heuristic estimates of public bracket behavior, not predictions of
            who will win. Actual contest ownership may vary.
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
