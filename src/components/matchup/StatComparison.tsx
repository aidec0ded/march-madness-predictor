"use client";

/**
 * StatComparison — side-by-side horizontal bar comparison for ~15 key metrics.
 *
 * Each row shows a stat label centered with bars extending left (Team A)
 * and right (Team B). The team with the better value gets the accent color;
 * the other gets a muted color.
 */

import { memo } from "react";
import { ordinal } from "@/lib/engine/rankings";
import type { StatCategory } from "@/types/matchup-view";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @prop stats - Array of stat categories to compare */
/** @prop teamA - Team A data (for header) */
/** @prop teamB - Team B data (for header) */
interface StatComparisonProps {
  /** Array of stat categories to compare */
  stats: StatCategory[];
  /** Team A data (for header) */
  teamA: TeamSeason;
  /** Team B data (for header) */
  teamB: TeamSeason;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a value based on the format type */
function formatValue(value: number | null, format: "pct" | "decimal" | "integer"): string {
  if (value === null) return "—";
  switch (format) {
    case "pct":
      return (value * 100).toFixed(1) + "%";
    case "decimal":
      return value.toFixed(1);
    case "integer":
      return Math.round(value).toString();
  }
}

/**
 * Determines which team has the advantage for a given stat.
 * Returns "A", "B", or "tie".
 */
function getAdvantage(
  valueA: number | null,
  valueB: number | null,
  higherIsBetter: boolean
): "A" | "B" | "tie" {
  if (valueA === null || valueB === null) return "tie";
  if (valueA === valueB) return "tie";
  if (higherIsBetter) return valueA > valueB ? "A" : "B";
  return valueA < valueB ? "A" : "B";
}

/**
 * Calculates the bar width as a percentage based on how the value
 * compares to the range between both teams' values.
 */
function getBarWidth(
  value: number | null,
  otherValue: number | null
): number {
  if (value === null || otherValue === null) return 0;
  const max = Math.max(Math.abs(value), Math.abs(otherValue));
  if (max === 0) return 50;
  return (Math.abs(value) / max) * 100;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const StatComparison = memo(function StatComparison({
  stats,
  teamA,
  teamB,
}: StatComparisonProps) {
  // Group stats
  const groups: { label: string; key: string; stats: StatCategory[] }[] = [
    { label: "Efficiency", key: "efficiency", stats: stats.filter((s) => s.group === "efficiency") },
    { label: "Four Factors", key: "four_factors", stats: stats.filter((s) => s.group === "four_factors") },
    { label: "Shooting", key: "shooting", stats: stats.filter((s) => s.group === "shooting") },
    { label: "Other", key: "other", stats: stats.filter((s) => s.group === "other") },
  ];

  return (
    <div className="stat-comparison">
      {/* Header row */}
      <div className="stat-comparison__header">
        <span className="stat-comparison__team-label" style={{ color: "var(--accent-primary)" }}>
          {teamA.team.shortName}
        </span>
        <span className="stat-comparison__center-label">vs</span>
        <span className="stat-comparison__team-label" style={{ color: "var(--accent-danger)" }}>
          {teamB.team.shortName}
        </span>
      </div>

      {groups.map(
        (group) =>
          group.stats.length > 0 && (
            <div key={group.key} className="stat-comparison__group">
              <div className="stat-comparison__group-title">{group.label}</div>
              {group.stats.map((stat) => (
                <StatRow key={stat.label} stat={stat} />
              ))}
            </div>
          )
      )}

      <style jsx>{`
        .stat-comparison {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
        }
        .stat-comparison__header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .stat-comparison__team-label {
          font-size: 0.875rem;
          font-weight: 700;
          text-align: center;
        }
        .stat-comparison__center-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
        }
        .stat-comparison__group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-comparison__group-title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
      `}</style>
    </div>
  );
});

// ---------------------------------------------------------------------------
// StatRow sub-component
// ---------------------------------------------------------------------------

function StatRow({ stat }: { stat: StatCategory }) {
  const advantage = getAdvantage(stat.valueA, stat.valueB, stat.higherIsBetter);
  const valA = formatValue(stat.valueA, stat.format);
  const valB = formatValue(stat.valueB, stat.format);

  const barWidthA = getBarWidth(stat.valueA, stat.valueB);
  const barWidthB = getBarWidth(stat.valueB, stat.valueA);

  const colorA =
    advantage === "A" ? "var(--accent-primary)" : "var(--border-subtle)";
  const colorB =
    advantage === "B" ? "var(--accent-danger)" : "var(--border-subtle)";

  const rankA = stat.rankA;
  const rankB = stat.rankB;

  return (
    <div className="stat-row">
      {/* Team A value + rank + bar */}
      <div className="stat-row__side stat-row__side--left">
        {rankA != null && (
          <span className="stat-row__rank">{ordinal(rankA)}</span>
        )}
        <span
          className="stat-row__value"
          style={{
            color: advantage === "A" ? "var(--accent-primary)" : "var(--text-secondary)",
            fontWeight: advantage === "A" ? 700 : 400,
          }}
        >
          {valA}
        </span>
        <div className="stat-row__bar-container stat-row__bar-container--left">
          <div
            className="stat-row__bar"
            style={{
              width: `${barWidthA}%`,
              backgroundColor: colorA,
            }}
          />
        </div>
      </div>

      {/* Label */}
      <span className="stat-row__label">{stat.label}</span>

      {/* Team B value + rank + bar */}
      <div className="stat-row__side stat-row__side--right">
        <div className="stat-row__bar-container stat-row__bar-container--right">
          <div
            className="stat-row__bar"
            style={{
              width: `${barWidthB}%`,
              backgroundColor: colorB,
            }}
          />
        </div>
        <span
          className="stat-row__value"
          style={{
            color: advantage === "B" ? "var(--accent-danger)" : "var(--text-secondary)",
            fontWeight: advantage === "B" ? 700 : 400,
          }}
        >
          {valB}
        </span>
        {rankB != null && (
          <span className="stat-row__rank">{ordinal(rankB)}</span>
        )}
      </div>

      <style jsx>{`
        .stat-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 8px;
          padding: 3px 0;
        }
        .stat-row__side {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .stat-row__side--left {
          justify-content: flex-end;
        }
        .stat-row__side--right {
          justify-content: flex-start;
        }
        .stat-row__label {
          font-size: 0.6875rem;
          color: var(--text-muted);
          text-align: center;
          white-space: nowrap;
          min-width: 90px;
        }
        .stat-row__value {
          font-size: 0.75rem;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
          min-width: 48px;
          text-align: right;
        }
        .stat-row__side--right .stat-row__value {
          text-align: left;
        }
        .stat-row__rank {
          font-size: 0.625rem;
          color: var(--text-muted);
          white-space: nowrap;
          min-width: 24px;
        }
        .stat-row__side--left .stat-row__rank {
          text-align: right;
        }
        .stat-row__side--right .stat-row__rank {
          text-align: left;
        }
        .stat-row__bar-container {
          width: 60px;
          height: 6px;
          border-radius: 3px;
          background-color: var(--bg-elevated);
          overflow: hidden;
          flex-shrink: 0;
        }
        .stat-row__bar-container--left {
          display: flex;
          justify-content: flex-end;
        }
        .stat-row__bar-container--right {
          display: flex;
          justify-content: flex-start;
        }
        .stat-row__bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}
