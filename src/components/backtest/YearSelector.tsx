"use client";

import React from "react";
import {
  TRAIN_SEASONS,
  TEST_SEASONS,
  ANOMALOUS_SEASONS,
} from "@/types/backtest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface YearSelectorProps {
  selectedSeasons: number[];
  onChange: (seasons: number[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal year picker for backtest season selection.
 *
 * Displays available seasons grouped into TRAIN (2008-2019) and TEST (2021-2024)
 * sets. Each year renders as a clickable chip. Anomalous seasons (e.g., 2021)
 * are marked with a warning indicator. Includes "Select All" and "Clear" bulk
 * actions.
 */
export function YearSelector({ selectedSeasons, onChange }: YearSelectorProps) {
  const toggleYear = (year: number) => {
    if (selectedSeasons.includes(year)) {
      onChange(selectedSeasons.filter((y) => y !== year));
    } else {
      onChange([...selectedSeasons, year].sort((a, b) => a - b));
    }
  };

  const selectAll = () => {
    const all = [...TRAIN_SEASONS, ...TEST_SEASONS] as number[];
    onChange(all);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="year-selector">
      <div className="year-selector__controls">
        <button
          type="button"
          className="year-selector__bulk-btn"
          onClick={selectAll}
        >
          Select All
        </button>
        <button
          type="button"
          className="year-selector__bulk-btn"
          onClick={clearAll}
        >
          Clear
        </button>
      </div>

      <div className="year-selector__groups">
        {/* Train group */}
        <div className="year-selector__group">
          <span className="year-selector__group-label year-selector__group-label--train">
            TRAIN
          </span>
          <div className="year-selector__chips">
            {TRAIN_SEASONS.map((year) => {
              const isSelected = selectedSeasons.includes(year);
              const isAnomalous = year in ANOMALOUS_SEASONS;
              return (
                <button
                  key={year}
                  type="button"
                  className={`year-selector__chip ${isSelected ? "year-selector__chip--selected" : ""} ${isAnomalous ? "year-selector__chip--anomalous" : ""}`}
                  onClick={() => toggleYear(year)}
                  title={isAnomalous ? ANOMALOUS_SEASONS[year] : undefined}
                >
                  {year}
                  {isAnomalous && (
                    <span className="year-selector__anomaly-dot" aria-label="Anomalous season">
                      *
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Test group */}
        <div className="year-selector__group">
          <span className="year-selector__group-label year-selector__group-label--test">
            TEST
          </span>
          <div className="year-selector__chips">
            {TEST_SEASONS.map((year) => {
              const isSelected = selectedSeasons.includes(year);
              const isAnomalous = year in ANOMALOUS_SEASONS;
              return (
                <button
                  key={year}
                  type="button"
                  className={`year-selector__chip ${isSelected ? "year-selector__chip--selected" : ""} ${isAnomalous ? "year-selector__chip--anomalous" : ""}`}
                  onClick={() => toggleYear(year)}
                  title={isAnomalous ? ANOMALOUS_SEASONS[year] : undefined}
                >
                  {year}
                  {isAnomalous && (
                    <span className="year-selector__anomaly-dot" aria-label="Anomalous season">
                      *
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .year-selector {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 20px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: 10px;
        }

        .year-selector__controls {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .year-selector__bulk-btn {
          padding: 4px 12px;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          background: transparent;
          border: 1px solid var(--border-secondary);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .year-selector__bulk-btn:hover {
          color: var(--text-primary);
          border-color: var(--text-muted);
        }

        .year-selector__groups {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .year-selector__group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .year-selector__group-label {
          flex-shrink: 0;
          width: 48px;
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-align: center;
          padding: 3px 6px;
          border-radius: 4px;
        }

        .year-selector__group-label--train {
          color: var(--accent-primary);
          background: rgba(74, 144, 217, 0.12);
        }

        .year-selector__group-label--test {
          color: var(--warning);
          background: rgba(255, 183, 77, 0.12);
        }

        .year-selector__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .year-selector__chip {
          position: relative;
          padding: 6px 12px;
          font-size: 0.8125rem;
          font-weight: 600;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-secondary);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1;
        }

        .year-selector__chip:hover {
          color: var(--text-primary);
          border-color: var(--accent-primary);
          background: var(--bg-elevated);
        }

        .year-selector__chip--selected {
          color: #ffffff;
          background: var(--accent-primary);
          border-color: var(--accent-primary);
        }

        .year-selector__chip--selected:hover {
          background: var(--accent-secondary);
          border-color: var(--accent-secondary);
          color: #ffffff;
        }

        .year-selector__anomaly-dot {
          position: absolute;
          top: -2px;
          right: -1px;
          font-size: 0.875rem;
          font-weight: 800;
          line-height: 1;
          color: var(--warning);
        }
      `}</style>
    </div>
  );
}
