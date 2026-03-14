"use client";

import React from "react";
import type { BacktestResult } from "@/types/backtest";
import { FONT_MONO } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BaselineComparisonCardProps {
  result: BacktestResult | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBrier(value: number): string {
  return value.toFixed(3);
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Summary card displaying model vs. seed-based baseline performance.
 *
 * When no backtest result is available, shows an empty-state placeholder.
 * When populated, shows the six key headline numbers: overall model Brier,
 * overall baseline Brier, improvement percentage, train-set Brier,
 * test-set Brier, and total games scored. Improvement is color-coded
 * green (positive) or red (negative).
 */
export function BaselineComparisonCard({ result }: BaselineComparisonCardProps) {
  return (
    <div className="baseline-card">
      <div className="baseline-card__header">
        <h3 className="baseline-card__title">MODEL PERFORMANCE</h3>
      </div>

      <div className="baseline-card__body">
        {!result ? (
          <div className="baseline-card__empty">
            <p className="baseline-card__empty-text">
              Run a backtest to see model performance metrics.
            </p>
          </div>
        ) : (
          <div className="baseline-card__grid">
            {/* Model Brier */}
            <div className="baseline-card__metric">
              <span className="baseline-card__metric-label">Model Brier</span>
              <span className="baseline-card__metric-value">
                {formatBrier(result.overallModelBrier)}
              </span>
            </div>

            {/* Baseline Brier */}
            <div className="baseline-card__metric">
              <span className="baseline-card__metric-label">Baseline Brier</span>
              <span className="baseline-card__metric-value">
                {formatBrier(result.overallBaselineBrier)}
              </span>
            </div>

            {/* Improvement */}
            <div className="baseline-card__metric baseline-card__metric--highlight">
              <span className="baseline-card__metric-label">Improvement</span>
              <span
                className="baseline-card__metric-value"
                style={{
                  color:
                    result.overallImprovement >= 0
                      ? "var(--success)"
                      : "var(--danger)",
                }}
              >
                {formatPct(result.overallImprovement)}
              </span>
            </div>

            {/* Divider */}
            <div className="baseline-card__divider" />

            {/* Train Brier */}
            <div className="baseline-card__metric">
              <span className="baseline-card__metric-label">Train Brier</span>
              <span className="baseline-card__metric-value">
                {formatBrier(result.trainModelBrier)}
              </span>
            </div>

            {/* Test Brier */}
            <div className="baseline-card__metric">
              <span className="baseline-card__metric-label">Test Brier</span>
              <span className="baseline-card__metric-value">
                {formatBrier(result.testModelBrier)}
              </span>
            </div>

            {/* Games Scored */}
            <div className="baseline-card__metric">
              <span className="baseline-card__metric-label">Games Scored</span>
              <span className="baseline-card__metric-value">
                {result.totalGames.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .baseline-card {
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: 10px;
          overflow: hidden;
          height: 100%;
        }

        .baseline-card__header {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-primary);
          background: var(--bg-tertiary);
        }

        .baseline-card__title {
          margin: 0;
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .baseline-card__body {
          padding: 20px;
          flex: 1;
          display: flex;
          align-items: center;
        }

        .baseline-card__empty {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 120px;
        }

        .baseline-card__empty-text {
          margin: 0;
          font-size: 0.875rem;
          color: var(--text-muted);
          text-align: center;
          line-height: 1.5;
        }

        .baseline-card__grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px 24px;
          width: 100%;
        }

        .baseline-card__metric {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .baseline-card__metric-label {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .baseline-card__metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-family: ${FONT_MONO};
          color: var(--text-primary);
          line-height: 1.1;
        }

        .baseline-card__divider {
          grid-column: 1 / -1;
          height: 1px;
          background: var(--border-secondary);
        }
      `}</style>
    </div>
  );
}
