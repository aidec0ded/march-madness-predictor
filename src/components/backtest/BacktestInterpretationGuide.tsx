"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Collapsible guide explaining how to interpret backtest results.
 *
 * Covers: Brier Score basics, model vs. baseline comparison, train/test split,
 * calibration chart reading, and the 2021 COVID anomaly.
 *
 * Renders collapsed by default. Placed at the top of the backtest dashboard
 * so users can reference it before or after running a backtest.
 */
export function BacktestInterpretationGuide() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="interp-guide">
      <button
        type="button"
        className="interp-guide__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="interp-guide__chevron">
          {isExpanded ? "\u25BE" : "\u25B8"}
        </span>
        <span>How to Interpret Backtest Results</span>
      </button>

      {isExpanded && (
        <div className="interp-guide__content">
          <GuideSection
            title="Brier Score"
            body="A probability calibration metric ranging from 0 (perfect) to 1 (worst possible). Lower is better. A coin-flip model that always predicts 50% would score 0.250. Scores below 0.200 indicate meaningfully better-than-chance predictions."
          />
          <GuideSection
            title="Model vs. Baseline"
            body="The baseline uses only historical seed matchup win rates (e.g., 1-seeds have beaten 16-seeds 99.3% of the time since 1985). The improvement percentage shows how much value the full model — with efficiency ratings, Four Factors, and lever adjustments — adds over this seed-only approach."
          />
          <GuideSection
            title="Train vs. Test"
            body="Train years (2008–2019) were used to calibrate model weights. Test years (2021–2024) evaluate how well the model generalizes to unseen tournaments. Test performance is more predictive of future accuracy — if the model scores well on train but poorly on test, it may be overfitting."
          />
          <GuideSection
            title="Calibration Chart"
            body="Each point represents a bin of predictions. Points on the diagonal line mean perfect calibration (e.g., games predicted at 70% were won 70% of the time). Points above the diagonal: the model is under-confident (actual wins exceed predictions). Points below: the model is over-confident. Point size reflects the number of predictions in each bin."
          />
          <GuideSection
            title="2021 Anomaly"
            body="The 2021 tournament was played entirely in Indianapolis due to COVID-19. All games were effectively neutral-site, eliminating travel and home-court advantages. This makes 2021 an unusual data point — the model's site proximity adjustments had no real-world effect that year."
          />
        </div>
      )}

      <style jsx>{`
        .interp-guide {
          border-radius: 8px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          overflow: hidden;
        }
        .interp-guide__toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--text-secondary);
          transition: color 0.15s ease;
        }
        .interp-guide__toggle:hover {
          color: var(--text-primary);
        }
        .interp-guide__chevron {
          font-size: 0.75rem;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .interp-guide__content {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 0 16px 16px;
          border-top: 1px solid var(--border-primary);
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GuideSection({ title, body }: { title: string; body: string }) {
  return (
    <div className="guide-section">
      <h4 className="guide-section__title">{title}</h4>
      <p className="guide-section__body">{body}</p>
      <style jsx>{`
        .guide-section {
          padding-top: 12px;
        }
        .guide-section__title {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .guide-section__body {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
