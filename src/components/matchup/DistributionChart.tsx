"use client";

/**
 * DistributionChart — Recharts histogram of margin-of-victory distribution.
 *
 * Shows a bar chart with bins colored by winner:
 * - Positive margins (Team A wins) use --accent-primary
 * - Negative margins (Team B wins) use --accent-danger
 * - Zero line is highlighted
 */

import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { DistributionBin } from "@/types/matchup-view";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @prop bins - Histogram bin data */
/** @prop teamA - Team A data (for labels) */
/** @prop teamB - Team B data (for labels) */
interface DistributionChartProps {
  /** Histogram bin data from generateMatchupDistribution */
  bins: DistributionBin[];
  /** Team A data (for labels) */
  teamA: TeamSeason;
  /** Team B data (for labels) */
  teamB: TeamSeason;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayload {
  margin: number;
  count: number;
  winner: "A" | "B";
}

function CustomTooltip({
  active,
  payload,
  teamAName,
  teamBName,
}: {
  active?: boolean;
  payload?: Array<{ payload: TooltipPayload }>;
  teamAName: string;
  teamBName: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const winnerName = data.winner === "A" ? teamAName : teamBName;
  const absMargin = Math.abs(data.margin);

  return (
    <div
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "0.75rem",
      }}
    >
      <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>
        {winnerName} by {absMargin.toFixed(0)}
      </div>
      <div style={{ color: "var(--text-muted)" }}>
        {data.count} simulations
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DistributionChart = memo(function DistributionChart({
  bins,
  teamA,
  teamB,
}: DistributionChartProps) {
  // Compute the colors in the render to use CSS variables
  // Since Recharts doesn't directly support CSS variables in fill props,
  // we use the computed style values
  const chartData = useMemo(
    () =>
      bins.map((bin) => ({
        ...bin,
        fill: bin.winner === "A" ? "#4a90d9" : "#ef4444",
      })),
    [bins]
  );

  return (
    <div className="distribution-chart">
      <div className="distribution-chart__header">
        <span className="distribution-chart__title">
          Outcome Distribution (1,000 simulations)
        </span>
      </div>

      <div className="distribution-chart__labels">
        <span style={{ color: "var(--accent-danger)", fontSize: "0.75rem", fontWeight: 600 }}>
          {teamB.team.shortName} wins
        </span>
        <span style={{ color: "var(--accent-primary)", fontSize: "0.75rem", fontWeight: 600 }}>
          {teamA.team.shortName} wins
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          barCategoryGap={0}
          barGap={0}
        >
          <XAxis
            dataKey="margin"
            tick={{ fill: "#9898a8", fontSize: 10 }}
            tickLine={{ stroke: "#2a2a3d" }}
            axisLine={{ stroke: "#2a2a3d" }}
            interval={4}
            tickFormatter={(val: number) =>
              val === 0 ? "0" : val > 0 ? `+${val}` : `${val}`
            }
          />
          <YAxis
            tick={{ fill: "#9898a8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            content={
              <CustomTooltip
                teamAName={teamA.team.shortName}
                teamBName={teamB.team.shortName}
              />
            }
            cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
          />
          <ReferenceLine
            x={-1}
            stroke="#6a6a7d"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <style jsx>{`
        .distribution-chart {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          border-radius: 8px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
        }
        .distribution-chart__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .distribution-chart__title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }
        .distribution-chart__labels {
          display: flex;
          justify-content: space-between;
          padding: 0 8px;
        }
      `}</style>
    </div>
  );
});
