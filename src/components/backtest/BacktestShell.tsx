"use client";

import React from "react";
import { useBacktest } from "@/hooks/useBacktest";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { YearSelector } from "@/components/backtest/YearSelector";
import { LeverTuningPanel } from "@/components/backtest/LeverTuningPanel";
import { BaselineComparisonCard } from "@/components/backtest/BaselineComparisonCard";
import { BrierScoreChart } from "@/components/backtest/BrierScoreChart";
import { CalibrationPlot } from "@/components/backtest/CalibrationPlot";
import { BacktestResultsTable } from "@/components/backtest/BacktestResultsTable";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Top-level client shell for the backtest dashboard page.
 *
 * Orchestrates all backtest UI: header with run button, year selector,
 * lever tuning, baseline comparison, and visualization slots for charts
 * and tables. Uses the `useBacktest` hook for all state management,
 * including selected seasons, engine config, run status, and results.
 *
 * Layout:
 * - Header:        "BACKTEST DASHBOARD" title + "Run Backtest" button
 * - YearSelector:  Season selection chips (full width)
 * - Two columns:   LeverTuningPanel (left) + BaselineComparisonCard (right)
 * - Full width:    BrierScoreChart
 * - Two columns:   CalibrationPlot (left) + BacktestResultsTable (right)
 */
export function BacktestShell() {
  const {
    selectedSeasons,
    setSelectedSeasons,
    engineConfig,
    setEngineConfig,
    result,
    isRunning,
    error,
    runBacktest,
  } = useBacktest();

  return (
    <div className="backtest-shell">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="backtest-shell__header">
        <div className="backtest-shell__header-left">
          <h1 className="backtest-shell__title">BACKTEST DASHBOARD</h1>
        </div>
        <div className="backtest-shell__header-right">
          <button
            type="button"
            className="backtest-shell__run-btn"
            onClick={runBacktest}
            disabled={isRunning || selectedSeasons.length === 0}
          >
            {isRunning ? (
              <span className="backtest-shell__run-btn-inner">
                <LoadingSpinner size={14} />
                <span>Running...</span>
              </span>
            ) : (
              "Run Backtest"
            )}
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Error Banner                                                       */}
      {/* ----------------------------------------------------------------- */}
      {error && (
        <div className="backtest-shell__error">
          <span className="backtest-shell__error-icon">!</span>
          <span className="backtest-shell__error-text">{error}</span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Year Selector                                                      */}
      {/* ----------------------------------------------------------------- */}
      <section className="backtest-shell__section">
        <YearSelector
          selectedSeasons={selectedSeasons}
          onChange={setSelectedSeasons}
        />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Config + Performance (two columns)                                 */}
      {/* ----------------------------------------------------------------- */}
      <section className="backtest-shell__two-col">
        <div className="backtest-shell__col-left">
          <LeverTuningPanel config={engineConfig} onChange={setEngineConfig} />
        </div>
        <div className="backtest-shell__col-right">
          <BaselineComparisonCard result={result} />
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Brier Score Chart (full width)                                     */}
      {/* ----------------------------------------------------------------- */}
      <section className="backtest-shell__section">
        <BrierScoreChart result={result} />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Calibration + Results Table (two columns)                          */}
      {/* ----------------------------------------------------------------- */}
      <section className="backtest-shell__two-col">
        <div className="backtest-shell__col-left">
          <CalibrationPlot result={result} />
        </div>
        <div className="backtest-shell__col-right">
          <BacktestResultsTable result={result} />
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Loading Overlay                                                    */}
      {/* ----------------------------------------------------------------- */}
      {isRunning && (
        <div className="backtest-shell__overlay">
          <div className="backtest-shell__overlay-content">
            <LoadingSpinner size={40} />
            <p className="backtest-shell__overlay-text">
              Running backtest across {selectedSeasons.length} season(s)...
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .backtest-shell {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 100vh;
          padding: 24px 32px 48px;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        /* ----- Header ----- */

        .backtest-shell__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-primary);
        }

        .backtest-shell__header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .backtest-shell__title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-primary);
        }

        .backtest-shell__header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .backtest-shell__run-btn {
          padding: 10px 24px;
          font-size: 0.8125rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #ffffff;
          background: var(--accent-primary);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .backtest-shell__run-btn:hover:not(:disabled) {
          background: var(--accent-secondary);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(74, 144, 217, 0.3);
        }

        .backtest-shell__run-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .backtest-shell__run-btn-inner {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ----- Error Banner ----- */

        .backtest-shell__error {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(239, 83, 80, 0.08);
          border: 1px solid var(--danger);
          border-radius: 8px;
        }

        .backtest-shell__error-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          font-size: 0.75rem;
          font-weight: 800;
          color: #ffffff;
          background: var(--danger);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .backtest-shell__error-text {
          font-size: 0.8125rem;
          color: var(--danger);
          line-height: 1.4;
        }

        /* ----- Sections ----- */

        .backtest-shell__section {
          display: flex;
          flex-direction: column;
        }

        .backtest-shell__two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          align-items: start;
        }

        .backtest-shell__col-left,
        .backtest-shell__col-right {
          min-width: 0;
        }

        /* ----- Loading Overlay ----- */

        .backtest-shell__overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
        }

        .backtest-shell__overlay-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 40px 48px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-primary);
          border-radius: 14px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
        }

        .backtest-shell__overlay-text {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        /* ----- Responsive ----- */

        @media (max-width: 900px) {
          .backtest-shell {
            padding: 16px 16px 32px;
            gap: 16px;
          }

          .backtest-shell__two-col {
            grid-template-columns: 1fr;
          }

          .backtest-shell__title {
            font-size: 0.9375rem;
          }
        }
      `}</style>
    </div>
  );
}
