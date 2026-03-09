"use client";

/**
 * BrierScoreChart — Recharts LineChart of Brier Score by year.
 *
 * Two lines compare the model vs a naive seed-based baseline.
 * Background bands distinguish train vs test years.
 * Anomalous years (e.g., 2021 COVID bubble) are marked with
 * a distinct triangle marker.
 */

import { memo, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import type { BacktestResult } from "@/types/backtest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  model: "#f97316", // --accent-primary (orange)
  baseline: "#64748b", // --text-muted (gray)
  bgPrimary: "#0a0e17",
  bgSecondary: "#111827",
  bgElevated: "#1a2332",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  borderPrimary: "#1e293b",
  trainBand: "rgba(59, 130, 246, 0.06)", // subtle blue tint for train
  testBand: "rgba(249, 115, 22, 0.06)", // subtle orange tint for test
  gridStroke: "#1e293b",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrierScoreChartProps {
  result: BacktestResult | null;
}

interface ChartDataPoint {
  season: number;
  modelBrier: number;
  baselineBrier: number;
  splitLabel: "train" | "test";
  anomalous: boolean;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function BrierTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    payload: ChartDataPoint;
  }>;
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0]?.payload;
  if (!dataPoint) return null;

  const modelVal =
    payload.find((p) => p.dataKey === "modelBrier")?.value ?? 0;
  const baselineVal =
    payload.find((p) => p.dataKey === "baselineBrier")?.value ?? 0;
  const improvement =
    baselineVal > 0 ? ((baselineVal - modelVal) / baselineVal) * 100 : 0;

  return (
    <div className="brier-tooltip">
      <div className="brier-tooltip__header">
        {label}
        {dataPoint.anomalous && (
          <span className="brier-tooltip__anomaly"> (Anomalous)</span>
        )}
      </div>
      <div className="brier-tooltip__row">
        <span
          className="brier-tooltip__dot"
          style={{ backgroundColor: COLORS.model }}
        />
        <span className="brier-tooltip__label">Model:</span>
        <span className="brier-tooltip__value">{modelVal.toFixed(4)}</span>
      </div>
      <div className="brier-tooltip__row">
        <span
          className="brier-tooltip__dot"
          style={{ backgroundColor: COLORS.baseline }}
        />
        <span className="brier-tooltip__label">Baseline:</span>
        <span className="brier-tooltip__value">
          {baselineVal.toFixed(4)}
        </span>
      </div>
      <div className="brier-tooltip__row brier-tooltip__row--improvement">
        <span className="brier-tooltip__label">Improvement:</span>
        <span
          className="brier-tooltip__value"
          style={{ color: improvement >= 0 ? "#22c55e" : "#ef4444" }}
        >
          {improvement >= 0 ? "+" : ""}
          {improvement.toFixed(1)}%
        </span>
      </div>

      <style jsx>{`
        .brier-tooltip {
          background-color: ${COLORS.bgElevated};
          border: 1px solid ${COLORS.borderPrimary};
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 0.75rem;
          min-width: 160px;
        }
        .brier-tooltip__header {
          color: ${COLORS.textPrimary};
          font-weight: 700;
          margin-bottom: 6px;
          font-size: 0.8125rem;
        }
        .brier-tooltip__anomaly {
          color: #eab308;
          font-weight: 400;
          font-size: 0.6875rem;
        }
        .brier-tooltip__row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
        }
        .brier-tooltip__row--improvement {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid ${COLORS.borderPrimary};
        }
        .brier-tooltip__dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .brier-tooltip__label {
          color: ${COLORS.textSecondary};
        }
        .brier-tooltip__value {
          color: ${COLORS.textPrimary};
          font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
          margin-left: auto;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom dot for anomalous years (triangle marker)
// ---------------------------------------------------------------------------

function AnomalyDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
  stroke?: string;
  fill?: string;
  dataKey?: string;
}) {
  const { cx, cy, payload, stroke } = props;
  if (!cx || !cy || !payload) return null;

  if (payload.anomalous) {
    // Triangle marker for anomalous years
    const size = 6;
    const points = [
      `${cx},${cy - size}`,
      `${cx - size},${cy + size}`,
      `${cx + size},${cy + size}`,
    ].join(" ");

    return (
      <polygon
        points={points}
        fill={stroke}
        stroke={stroke}
        strokeWidth={1.5}
      />
    );
  }

  // Default circle dot
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill={COLORS.bgSecondary}
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BrierScoreChart = memo(function BrierScoreChart({
  result,
}: BrierScoreChartProps) {
  const chartData = useMemo(() => {
    if (!result) return [];
    return result.years.map((y) => ({
      season: y.season,
      modelBrier: y.modelScore.overallBrier,
      baselineBrier: y.baselineScore.overallBrier,
      splitLabel: y.splitLabel,
      anomalous: y.anomalous,
    }));
  }, [result]);

  // Compute train/test year ranges for background bands
  const bands = useMemo(() => {
    if (chartData.length === 0) return { train: [], test: [] };

    const trainYears = chartData
      .filter((d) => d.splitLabel === "train")
      .map((d) => d.season);
    const testYears = chartData
      .filter((d) => d.splitLabel === "test")
      .map((d) => d.season);

    return {
      train:
        trainYears.length > 0
          ? [{ x1: Math.min(...trainYears) - 0.5, x2: Math.max(...trainYears) + 0.5 }]
          : [],
      test:
        testYears.length > 0
          ? [{ x1: Math.min(...testYears) - 0.5, x2: Math.max(...testYears) + 0.5 }]
          : [],
    };
  }, [chartData]);

  return (
    <div className="brier-chart-card">
      <div className="brier-chart-card__header">
        <h3 className="brier-chart-card__title">BRIER SCORE BY YEAR</h3>
        {result && (
          <span className="brier-chart-card__subtitle">
            Lower is better
          </span>
        )}
      </div>

      {!result ? (
        <div className="brier-chart-card__placeholder">
          Run a backtest to see Brier Score trends across seasons.
        </div>
      ) : (
        <div className="brier-chart-card__body">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={COLORS.gridStroke}
                vertical={false}
              />

              {/* Background bands for train/test splits */}
              {bands.train.map((b, i) => (
                <ReferenceArea
                  key={`train-${i}`}
                  x1={b.x1}
                  x2={b.x2}
                  fill={COLORS.trainBand}
                  fillOpacity={1}
                  ifOverflow="extendDomain"
                />
              ))}
              {bands.test.map((b, i) => (
                <ReferenceArea
                  key={`test-${i}`}
                  x1={b.x1}
                  x2={b.x2}
                  fill={COLORS.testBand}
                  fillOpacity={1}
                  ifOverflow="extendDomain"
                />
              ))}

              <XAxis
                dataKey="season"
                tick={{ fill: COLORS.textMuted, fontSize: 11 }}
                tickLine={{ stroke: COLORS.borderPrimary }}
                axisLine={{ stroke: COLORS.borderPrimary }}
                tickFormatter={(val: number) => `'${String(val).slice(-2)}`}
              />
              <YAxis
                tick={{
                  fill: COLORS.textMuted,
                  fontSize: 11,
                  fontFamily:
                    '"SF Mono", "Fira Code", "Cascadia Code", monospace',
                }}
                tickLine={false}
                axisLine={false}
                width={50}
                domain={["auto", "auto"]}
                tickFormatter={(val: number) => val.toFixed(3)}
              />

              <Tooltip
                content={<BrierTooltip />}
                cursor={{
                  stroke: COLORS.textMuted,
                  strokeDasharray: "3 3",
                  strokeWidth: 1,
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                iconType="line"
                wrapperStyle={{
                  fontSize: "0.6875rem",
                  color: COLORS.textSecondary,
                  paddingBottom: "8px",
                }}
              />

              <Line
                type="monotone"
                dataKey="modelBrier"
                name="Model"
                stroke={COLORS.model}
                strokeWidth={2}
                dot={<AnomalyDot />}
                activeDot={{
                  r: 5,
                  fill: COLORS.model,
                  stroke: COLORS.bgSecondary,
                  strokeWidth: 2,
                }}
              />
              <Line
                type="monotone"
                dataKey="baselineBrier"
                name="Baseline"
                stroke={COLORS.baseline}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={<AnomalyDot />}
                activeDot={{
                  r: 5,
                  fill: COLORS.baseline,
                  stroke: COLORS.bgSecondary,
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Legend supplement for split bands and anomaly marker */}
          <div className="brier-chart-card__legend-supplement">
            <span className="brier-chart-card__legend-item">
              <span
                className="brier-chart-card__legend-swatch"
                style={{ backgroundColor: "rgba(59, 130, 246, 0.2)" }}
              />
              Train
            </span>
            <span className="brier-chart-card__legend-item">
              <span
                className="brier-chart-card__legend-swatch"
                style={{ backgroundColor: "rgba(249, 115, 22, 0.2)" }}
              />
              Test
            </span>
            <span className="brier-chart-card__legend-item">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <polygon
                  points="6,1 1,11 11,11"
                  fill={COLORS.textMuted}
                  stroke="none"
                />
              </svg>
              Anomalous
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        .brier-chart-card {
          background-color: ${COLORS.bgSecondary};
          border: 1px solid ${COLORS.borderPrimary};
          border-radius: 8px;
          overflow: hidden;
        }
        .brier-chart-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px 0;
        }
        .brier-chart-card__title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: ${COLORS.textMuted};
          margin: 0;
        }
        .brier-chart-card__subtitle {
          font-size: 0.625rem;
          color: ${COLORS.textMuted};
          font-style: italic;
        }
        .brier-chart-card__body {
          padding: 8px 8px 16px;
        }
        .brier-chart-card__placeholder {
          padding: 64px 20px;
          text-align: center;
          color: ${COLORS.textMuted};
          font-size: 0.875rem;
        }
        .brier-chart-card__legend-supplement {
          display: flex;
          justify-content: center;
          gap: 20px;
          padding: 4px 20px 0;
          font-size: 0.6875rem;
          color: ${COLORS.textMuted};
        }
        .brier-chart-card__legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .brier-chart-card__legend-swatch {
          display: inline-block;
          width: 12px;
          height: 10px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
});
