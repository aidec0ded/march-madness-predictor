"use client";

/**
 * BacktestResultsTable — Per-year results table with sortable columns.
 *
 * Displays model vs baseline Brier Scores for each season, with
 * improvement percentages color-coded and train/test split labels.
 * Anomalous years are marked with a warning indicator.
 */

import { memo, useMemo, useState, useCallback } from "react";
import type { BacktestResult, BacktestYearResult } from "@/types/backtest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  bgPrimary: "#0a0e17",
  bgSecondary: "#111827",
  bgElevated: "#1a2332",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  accentPrimary: "#f97316",
  accentSecondary: "#3b82f6",
  borderPrimary: "#1e293b",
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BacktestResultsTableProps {
  result: BacktestResult | null;
}

type SortField =
  | "season"
  | "modelBrier"
  | "baselineBrier"
  | "improvement"
  | "games"
  | "split";
type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBrier(value: number): string {
  return value.toFixed(3);
}

function formatImprovement(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function getSortValue(year: BacktestYearResult, field: SortField): number | string {
  switch (field) {
    case "season":
      return year.season;
    case "modelBrier":
      return year.modelScore.overallBrier;
    case "baselineBrier":
      return year.baselineScore.overallBrier;
    case "improvement":
      return year.improvement;
    case "games":
      return year.gamesEvaluated;
    case "split":
      return year.splitLabel;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Sort indicator
// ---------------------------------------------------------------------------

function SortArrow({
  field,
  activeField,
  direction,
}: {
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
}) {
  if (field !== activeField) {
    return (
      <span className="sort-arrow sort-arrow--inactive">
        <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
          <path d="M4 0L7.5 4H0.5L4 0Z" fill={COLORS.textMuted} opacity={0.3} />
          <path d="M4 10L0.5 6H7.5L4 10Z" fill={COLORS.textMuted} opacity={0.3} />
        </svg>
        <style jsx>{`
          .sort-arrow {
            margin-left: 4px;
            display: inline-flex;
            align-items: center;
          }
        `}</style>
      </span>
    );
  }

  return (
    <span className="sort-arrow sort-arrow--active">
      <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
        {direction === "asc" ? (
          <path d="M4 0L7.5 4H0.5L4 0Z" fill={COLORS.accentPrimary} />
        ) : (
          <path d="M4 10L0.5 6H7.5L4 10Z" fill={COLORS.accentPrimary} />
        )}
      </svg>
      <style jsx>{`
        .sort-arrow--active {
          margin-left: 4px;
          display: inline-flex;
          align-items: center;
        }
      `}</style>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BacktestResultsTable = memo(function BacktestResultsTable({
  result,
}: BacktestResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>("season");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const sortedYears = useMemo(() => {
    if (!result) return [];

    const years = [...result.years];
    years.sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);

      let cmp: number;
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = (aVal as number) - (bVal as number);
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return years;
  }, [result, sortField, sortDirection]);

  // Summary row
  const summary = useMemo(() => {
    if (!result) return null;
    return {
      modelBrier: result.overallModelBrier,
      baselineBrier: result.overallBaselineBrier,
      improvement: result.overallImprovement,
      totalGames: result.totalGames,
    };
  }, [result]);

  const columns: { key: SortField; label: string; align: "left" | "right" }[] =
    [
      { key: "season", label: "Year", align: "left" },
      { key: "modelBrier", label: "Model Brier", align: "right" },
      { key: "baselineBrier", label: "Baseline Brier", align: "right" },
      { key: "improvement", label: "Improvement", align: "right" },
      { key: "games", label: "Games", align: "right" },
      { key: "split", label: "Split", align: "left" },
    ];

  return (
    <div className="results-table-card">
      <div className="results-table-card__header">
        <h3 className="results-table-card__title">PER-YEAR RESULTS</h3>
        {result && (
          <span className="results-table-card__count">
            {result.years.length} seasons
          </span>
        )}
      </div>

      {!result ? (
        <div className="results-table-card__placeholder">
          Run a backtest to see per-year performance breakdown.
        </div>
      ) : (
        <div className="results-table-card__body">
          <table className="results-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`results-table__th results-table__th--${col.align}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="results-table__th-inner">
                      {col.label}
                      <SortArrow
                        field={col.key}
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedYears.map((year) => (
                <tr key={year.season} className="results-table__row">
                  {/* Year */}
                  <td className="results-table__td results-table__td--year">
                    <span className="results-table__year-value">
                      {year.season}
                    </span>
                    {year.anomalous && (
                      <span
                        className="results-table__anomaly-icon"
                        title={year.anomalyNote ?? "Anomalous season"}
                      >
                        &#x26A0;
                      </span>
                    )}
                  </td>

                  {/* Model Brier */}
                  <td className="results-table__td results-table__td--mono results-table__td--right">
                    {formatBrier(year.modelScore.overallBrier)}
                  </td>

                  {/* Baseline Brier */}
                  <td className="results-table__td results-table__td--mono results-table__td--right">
                    {formatBrier(year.baselineScore.overallBrier)}
                  </td>

                  {/* Improvement */}
                  <td
                    className="results-table__td results-table__td--mono results-table__td--right"
                    style={{
                      color:
                        year.improvement >= 0 ? COLORS.success : COLORS.danger,
                    }}
                  >
                    {formatImprovement(year.improvement)}
                  </td>

                  {/* Games */}
                  <td className="results-table__td results-table__td--mono results-table__td--right">
                    {year.gamesEvaluated}
                  </td>

                  {/* Split */}
                  <td className="results-table__td">
                    <span
                      className={`results-table__split-badge results-table__split-badge--${year.splitLabel}`}
                    >
                      {year.splitLabel === "train" ? "Train" : "Test"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Summary footer */}
            {summary && (
              <tfoot>
                <tr className="results-table__summary-row">
                  <td className="results-table__td results-table__td--summary">
                    Overall
                  </td>
                  <td className="results-table__td results-table__td--mono results-table__td--right results-table__td--summary">
                    {formatBrier(summary.modelBrier)}
                  </td>
                  <td className="results-table__td results-table__td--mono results-table__td--right results-table__td--summary">
                    {formatBrier(summary.baselineBrier)}
                  </td>
                  <td
                    className="results-table__td results-table__td--mono results-table__td--right results-table__td--summary"
                    style={{
                      color:
                        summary.improvement >= 0
                          ? COLORS.success
                          : COLORS.danger,
                    }}
                  >
                    {formatImprovement(summary.improvement)}
                  </td>
                  <td className="results-table__td results-table__td--mono results-table__td--right results-table__td--summary">
                    {summary.totalGames}
                  </td>
                  <td className="results-table__td results-table__td--summary">
                    &mdash;
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <style jsx>{`
        .results-table-card {
          background-color: ${COLORS.bgSecondary};
          border: 1px solid ${COLORS.borderPrimary};
          border-radius: 8px;
          overflow: hidden;
        }
        .results-table-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
        }
        .results-table-card__title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: ${COLORS.textMuted};
          margin: 0;
        }
        .results-table-card__count {
          font-size: 0.625rem;
          color: ${COLORS.textMuted};
        }
        .results-table-card__placeholder {
          padding: 64px 20px;
          text-align: center;
          color: ${COLORS.textMuted};
          font-size: 0.875rem;
        }
        .results-table-card__body {
          overflow-x: auto;
        }
        .results-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
        }
        .results-table__th {
          padding: 8px 16px;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: ${COLORS.textMuted};
          border-bottom: 1px solid ${COLORS.borderPrimary};
          white-space: nowrap;
          cursor: pointer;
          user-select: none;
          transition: color 0.15s ease;
        }
        .results-table__th:hover {
          color: ${COLORS.textSecondary};
        }
        .results-table__th--left {
          text-align: left;
        }
        .results-table__th--right {
          text-align: right;
        }
        .results-table__th-inner {
          display: inline-flex;
          align-items: center;
        }
        .results-table__row {
          transition: background-color 0.15s ease;
        }
        .results-table__row:hover {
          background-color: ${COLORS.bgElevated};
        }
        .results-table__td {
          padding: 10px 16px;
          color: ${COLORS.textPrimary};
          border-bottom: 1px solid ${COLORS.borderPrimary};
          white-space: nowrap;
        }
        .results-table__td--mono {
          font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
          font-size: 0.8125rem;
        }
        .results-table__td--right {
          text-align: right;
        }
        .results-table__td--year {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .results-table__year-value {
          font-weight: 600;
        }
        .results-table__anomaly-icon {
          font-size: 0.875rem;
          color: ${COLORS.warning};
          cursor: help;
          line-height: 1;
        }
        .results-table__td--summary {
          font-weight: 700;
          border-top: 2px solid ${COLORS.borderPrimary};
          border-bottom: none;
          color: ${COLORS.textPrimary};
        }
        .results-table__summary-row {
          background-color: rgba(249, 115, 22, 0.04);
        }
        .results-table__split-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .results-table__split-badge--train {
          background-color: rgba(59, 130, 246, 0.12);
          color: ${COLORS.accentSecondary};
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        .results-table__split-badge--test {
          background-color: rgba(249, 115, 22, 0.12);
          color: ${COLORS.accentPrimary};
          border: 1px solid rgba(249, 115, 22, 0.25);
        }
      `}</style>
    </div>
  );
});
