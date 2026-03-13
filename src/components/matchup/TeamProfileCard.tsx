"use client";

/**
 * TeamProfileCard — comprehensive team statistics card for the matchup view.
 *
 * Displays efficiency ratings, four factors, shooting splits, tempo,
 * experience metrics, and coaching data in a compact, data-dense layout.
 */

import { memo } from "react";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @prop team - The team's full season data */
/** @prop side - Which side of the comparison ("A" or "B"), affects accent color */
interface TeamProfileCardProps {
  /** The team's full season data */
  team: TeamSeason;
  /** Which side of the comparison ("A" or "B"), affects accent color */
  side: "A" | "B";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a percentage value (stored on 0-100 scale, e.g. 58.8 for 58.8%) */
function fmtPct(value: number): string {
  return value.toFixed(1) + "%";
}

/** Formats a decimal value */
function fmtDec(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact team profile card showing all key statistics.
 *
 * Organized into sections:
 * - Header: seed, name, conference
 * - Efficiency ratings (per source)
 * - Four Factors (offense/defense)
 * - Shooting splits
 * - Tempo and pace
 * - Roster metrics (experience, continuity, height, bench)
 * - Coaching record
 */
export const TeamProfileCard = memo(function TeamProfileCard({
  team,
  side,
}: TeamProfileCardProps) {
  const seed = team.tournamentEntry?.seed;
  const accentColor = side === "A" ? "var(--accent-primary)" : "var(--accent-danger)";

  return (
    <div className="team-profile-card">
      {/* Header */}
      <div className="team-profile-card__header">
        {seed && (
          <span className="team-profile-card__seed" style={{ color: accentColor }}>
            {seed}
          </span>
        )}
        <div className="team-profile-card__name-block">
          <span className="team-profile-card__name">{team.team.shortName}</span>
          <span className="team-profile-card__conference">{team.team.conference}</span>
        </div>
      </div>

      {/* Efficiency Ratings */}
      <Section title="Efficiency">
        {team.ratings.kenpom && (
          <StatRow label="KenPom AdjEM" value={fmtDec(team.ratings.kenpom.adjEM)} />
        )}
        {team.ratings.torvik && (
          <StatRow label="Torvik AdjEM" value={fmtDec(team.ratings.torvik.adjEM)} />
        )}
        {team.ratings.evanmiya && (
          <StatRow label="Evan Miya BPR" value={fmtDec(team.ratings.evanmiya.adjEM)} />
        )}
        {team.ratings.kenpom && (
          <>
            <StatRow label="Adj OE" value={fmtDec(team.ratings.kenpom.adjOE)} />
            <StatRow label="Adj DE" value={fmtDec(team.ratings.kenpom.adjDE)} />
          </>
        )}
      </Section>

      {/* Four Factors */}
      <Section title="Four Factors">
        <div className="team-profile-card__two-col">
          <div>
            <SectionSubtitle text="Offense" />
            <StatRow label="eFG%" value={fmtPct(team.fourFactorsOffense.efgPct)} />
            <StatRow label="TO%" value={fmtPct(team.fourFactorsOffense.toPct)} />
            <StatRow label="ORB%" value={fmtPct(team.fourFactorsOffense.orbPct)} />
            <StatRow label="FT Rate" value={fmtDec(team.fourFactorsOffense.ftRate, 1)} />
          </div>
          <div>
            <SectionSubtitle text="Defense" />
            {team.fourFactorsDefense ? (
              <>
                <StatRow label="eFG%" value={fmtPct(team.fourFactorsDefense.efgPct)} />
                <StatRow label="TO%" value={fmtPct(team.fourFactorsDefense.toPct)} />
                <StatRow label="ORB%" value={fmtPct(team.fourFactorsDefense.orbPct)} />
                <StatRow label="FT Rate" value={fmtDec(team.fourFactorsDefense.ftRate, 1)} />
              </>
            ) : (
              <StatRow label="Data" value="—" />
            )}
          </div>
        </div>
      </Section>

      {/* Shooting */}
      <Section title="Shooting">
        <StatRow label="3PT%" value={fmtPct(team.shootingOffense.threePtPct)} />
        <StatRow label="3PT Rate" value={fmtPct(team.shootingOffense.threePtRate)} />
        <StatRow label="FT%" value={fmtPct(team.shootingOffense.ftPct)} />
      </Section>

      {/* Tempo & Roster */}
      <Section title="Tempo & Roster">
        <StatRow label="Adj Tempo" value={fmtDec(team.adjTempo)} />
        <StatRow label="Experience" value={fmtDec(team.experience, 2)} />
        <StatRow label="Continuity" value={fmtPct(team.minutesContinuity)} />
        <StatRow label="Avg Height" value={`${fmtDec(team.avgHeight, 1)}"`} />
        <StatRow label="Bench Min%" value={fmtPct(team.benchMinutesPct)} />
        <StatRow label="2-Foul Part." value={fmtPct(team.twoFoulParticipation)} />
      </Section>

      {/* Coaching */}
      <Section title="Coach">
        <StatRow label="Name" value={team.coach.name} />
        <StatRow label="Tourn. Wins" value={String(team.coach.tournamentWins)} />
        <StatRow label="Final Fours" value={String(team.coach.finalFours)} />
        <StatRow label="Titles" value={String(team.coach.championships)} />
      </Section>

      <style jsx>{`
        .team-profile-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          border-radius: 8px;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          min-width: 260px;
          flex: 1;
        }
        .team-profile-card__header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 8px;
          border-bottom: 2px solid ${accentColor};
        }
        .team-profile-card__seed {
          font-size: 1.5rem;
          font-weight: 800;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
          line-height: 1;
        }
        .team-profile-card__name-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .team-profile-card__name {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .team-profile-card__conference {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .team-profile-card__two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
      `}</style>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="profile-section">
      <h4 className="profile-section__title">{title}</h4>
      <div className="profile-section__body">{children}</div>
      <style jsx>{`
        .profile-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .profile-section__title {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin: 0;
        }
        .profile-section__body {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
      `}</style>
    </div>
  );
}

function SectionSubtitle({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: "0.625rem",
        fontWeight: 600,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginBottom: "2px",
        display: "block",
      }}
    >
      {text}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__value">{value}</span>
      <style jsx>{`
        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 1px 0;
        }
        .stat-row__label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .stat-row__value {
          font-size: 0.75rem;
          font-weight: 600;
          font-family: "SF Mono", "Fira Code", "Consolas", monospace;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
