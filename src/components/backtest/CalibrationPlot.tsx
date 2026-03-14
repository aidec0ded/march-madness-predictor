"use client";

/**
 * CalibrationPlot — Recharts ScatterChart of predicted probability bins
 * vs actual win rates.
 *
 * A perfectly calibrated model would have all points on the diagonal line
 * from (0,0) to (1,1). Points above the diagonal indicate under-confidence
 * (actual > predicted), and points below indicate over-confidence.
 *
 * Scatter point size scales with the number of predictions in each bin.
 */

import { memo, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { BacktestResult } from "@/types/backtest";
import {
  ACCENT_PRIMARY,
  ACCENT_SUCCESS,
  ACCENT_WARNING,
  ACCENT_DANGER,
  BG_SECONDARY,
  BG_ELEVATED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BORDER_PRIMARY,
  FONT_MONO,
} from "@/lib/theme";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  point: ACCENT_PRIMARY,
  pointFill: "rgba(74, 144, 217, 0.85)", // accent-primary with opacity
  diagonal: TEXT_MUTED,
  bgSecondary: BG_SECONDARY,
  bgElevated: BG_ELEVATED,
  textPrimary: TEXT_PRIMARY,
  textSecondary: TEXT_SECONDARY,
  textMuted: TEXT_MUTED,
  borderPrimary: BORDER_PRIMARY,
  gridStroke: BORDER_PRIMARY,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalibrationPlotProps {
  result: BacktestResult | null;
}

interface PlotDataPoint {
  predicted: number;
  actual: number;
  count: number;
  binLabel: string;
  /** Scaled Z-value for Recharts point size */
  size: number;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function CalibrationTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PlotDataPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const diff = data.actual - data.predicted;

  return (
    <div className="cal-tooltip">
      <div className="cal-tooltip__header">{data.binLabel}</div>
      <div className="cal-tooltip__row">
        <span className="cal-tooltip__label">Predicted avg:</span>
        <span className="cal-tooltip__value">
          {(data.predicted * 100).toFixed(1)}%
        </span>
      </div>
      <div className="cal-tooltip__row">
        <span className="cal-tooltip__label">Actual rate:</span>
        <span className="cal-tooltip__value">
          {(data.actual * 100).toFixed(1)}%
        </span>
      </div>
      <div className="cal-tooltip__row cal-tooltip__row--diff">
        <span className="cal-tooltip__label">Difference:</span>
        <span
          className="cal-tooltip__value"
          style={{
            color:
              Math.abs(diff) < 0.03
                ? ACCENT_SUCCESS
                : Math.abs(diff) < 0.08
                  ? ACCENT_WARNING
                  : ACCENT_DANGER,
          }}
        >
          {diff >= 0 ? "+" : ""}
          {(diff * 100).toFixed(1)}pp
        </span>
      </div>
      <div className="cal-tooltip__row">
        <span className="cal-tooltip__label">Predictions:</span>
        <span className="cal-tooltip__value">{data.count}</span>
      </div>

      <style jsx>{`
        .cal-tooltip {
          background-color: ${COLORS.bgElevated};
          border: 1px solid ${COLORS.borderPrimary};
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 0.75rem;
          min-width: 170px;
        }
        .cal-tooltip__header {
          color: ${COLORS.textPrimary};
          font-weight: 700;
          margin-bottom: 6px;
          font-size: 0.8125rem;
        }
        .cal-tooltip__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 3px;
        }
        .cal-tooltip__row--diff {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid ${COLORS.borderPrimary};
        }
        .cal-tooltip__label {
          color: ${COLORS.textSecondary};
        }
        .cal-tooltip__value {
          color: ${COLORS.textPrimary};
          font-family: ${FONT_MONO};
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CalibrationPlot = memo(function CalibrationPlot({
  result,
}: CalibrationPlotProps) {
  const plotData = useMemo<PlotDataPoint[]>(() => {
    if (!result) return [];

    const filtered = result.calibration.filter((b) => b.count > 0);

    // Scale point sizes: min 40, max 400, based on count
    const maxCount = Math.max(...filtered.map((b) => b.count), 1);
    const minSize = 40;
    const maxSize = 400;

    return filtered.map((b) => ({
      predicted: b.avgPredicted,
      actual: b.actualWinRate,
      count: b.count,
      binLabel: `${(b.binStart * 100).toFixed(0)}\u2013${(b.binEnd * 100).toFixed(0)}%`,
      size: minSize + ((b.count / maxCount) * (maxSize - minSize)),
    }));
  }, [result]);

  // Diagonal reference points — we need two points for a line from (0,0) to (1,1)
  const diagonalData = useMemo(
    () => [
      { predicted: 0, actual: 0, count: 0, binLabel: "", size: 0 },
      { predicted: 1, actual: 1, count: 0, binLabel: "", size: 0 },
    ],
    []
  );

  return (
    <div className="cal-chart-card" role="img" aria-label="Scatter plot showing predicted win probability versus actual win rate for model calibration">
      <div className="cal-chart-card__header">
        <h3 className="cal-chart-card__title">CALIBRATION PLOT</h3>
        {result && (
          <span className="cal-chart-card__subtitle">
            Predicted vs actual win rate
          </span>
        )}
      </div>

      {!result ? (
        <div className="cal-chart-card__placeholder">
          Run a backtest to see model calibration analysis.
        </div>
      ) : (
        <div className="cal-chart-card__body">
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart
              margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={COLORS.gridStroke}
              />

              <XAxis
                type="number"
                dataKey="predicted"
                name="Predicted"
                domain={[0, 1]}
                ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                tick={{
                  fill: COLORS.textMuted,
                  fontSize: 11,
                  fontFamily: FONT_MONO,
                }}
                tickLine={{ stroke: COLORS.borderPrimary }}
                axisLine={{ stroke: COLORS.borderPrimary }}
                tickFormatter={(val: number) =>
                  `${(val * 100).toFixed(0)}%`
                }
                label={{
                  value: "Predicted Probability",
                  position: "insideBottom",
                  offset: -2,
                  fill: COLORS.textMuted,
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="actual"
                name="Actual"
                domain={[0, 1]}
                ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                tick={{
                  fill: COLORS.textMuted,
                  fontSize: 11,
                  fontFamily: FONT_MONO,
                }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(val: number) =>
                  `${(val * 100).toFixed(0)}%`
                }
                label={{
                  value: "Actual Win Rate",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  fill: COLORS.textMuted,
                  fontSize: 11,
                }}
              />

              <Tooltip
                content={<CalibrationTooltip />}
                cursor={{
                  stroke: COLORS.textMuted,
                  strokeDasharray: "3 3",
                  strokeWidth: 1,
                }}
              />

              {/* Perfect calibration diagonal line */}
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                ]}
                stroke={COLORS.diagonal}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: "Perfect",
                  position: "insideTopLeft",
                  fill: COLORS.textMuted,
                  fontSize: 10,
                }}
              />

              {/* Actual data points */}
              <Scatter
                data={plotData}
                fill={COLORS.pointFill}
                stroke={COLORS.point}
                strokeWidth={1.5}
                shape="circle"
              />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Annotation legend */}
          <div className="cal-chart-card__annotation">
            <span>
              Point size proportional to number of predictions in bin
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        .cal-chart-card {
          background-color: ${COLORS.bgSecondary};
          border: 1px solid ${COLORS.borderPrimary};
          border-radius: 8px;
          overflow: hidden;
        }
        .cal-chart-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px 0;
        }
        .cal-chart-card__title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: ${COLORS.textMuted};
          margin: 0;
        }
        .cal-chart-card__subtitle {
          font-size: 0.625rem;
          color: ${COLORS.textMuted};
          font-style: italic;
        }
        .cal-chart-card__body {
          padding: 8px 8px 16px;
        }
        .cal-chart-card__placeholder {
          padding: 64px 20px;
          text-align: center;
          color: ${COLORS.textMuted};
          font-size: 0.875rem;
        }
        .cal-chart-card__annotation {
          text-align: center;
          font-size: 0.625rem;
          color: ${COLORS.textMuted};
          padding: 0 20px;
          font-style: italic;
        }
      `}</style>
    </div>
  );
});
