"use client";

import { useBracket } from "@/hooks/useBracket";
import { ProbabilityBar } from "@/components/bracket/ProbabilityBar";
import type { TournamentRound } from "@/types/team";
import styles from "./SimulationResultsOverlay.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimulationResultsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Round display names
// ---------------------------------------------------------------------------

const ROUND_LABELS: Record<TournamentRound, string> = {
  FF: "First Four",
  R64: "Round of 64",
  R32: "Round of 32",
  S16: "Sweet 16",
  E8: "Elite 8",
  F4: "Final Four",
  NCG: "Championship",
};

const ROUND_ORDER: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Collapsible panel that displays simulation results below the header bar.
 *
 * Shows:
 * - Most likely champion with seed badge and probability
 * - Top 10 championship contenders with probability bars
 * - Upset rates by round
 * - Simulation metadata (count, execution time)
 *
 * Non-blocking: does not overlay the bracket; pushes content down.
 */
export function SimulationResultsOverlay({
  isOpen,
  onClose,
}: SimulationResultsOverlayProps) {
  const { state } = useBracket();
  const { simulationResult, teams } = state;

  if (!isOpen || !simulationResult) return null;

  const champion = simulationResult.mostLikelyChampion;
  const championTeam = teams.get(champion.teamId);
  const championEntry = championTeam?.tournamentEntry;

  // Normalize probability bars relative to the top contender
  const topMaxProb = simulationResult.topChampions[0]?.probability ?? 0;

  return (
    <div className={styles.overlay}>
      {/* Header row */}
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Simulation Results</h3>
          <p className={styles.subtitle}>
            Based on {simulationResult.numSimulations.toLocaleString()} full-bracket
            simulations using your current lever settings. Path probabilities account
            for all possible matchup combinations.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close results"
          className={styles.closeButton}
        >
          &times;
        </button>
      </div>

      {/* Stale results banner */}
      {state.isSimulationStale && (
        <div className={styles.staleBanner}>
          Results may be outdated — re-run simulation to reflect your latest changes.
        </div>
      )}

      {/* Content grid */}
      <div className={styles.contentGrid}>
        {/* Most likely champion */}
        <div>
          <div className={styles.sectionLabel}>Most Likely Champion</div>
          <div className={styles.championRow}>
            {championEntry && (
              <span className={styles.seedBadge}>{championEntry.seed}</span>
            )}
            <span className={styles.championName}>
              {championTeam?.team.name ?? champion.teamId}
            </span>
          </div>
          <div className={styles.championProb}>
            {(champion.probability * 100).toFixed(1)}%
          </div>
        </div>

        {/* Top 10 champions table */}
        <div>
          <div className={styles.sectionLabel}>Top 10 Championship Contenders</div>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHead}>
                <th className={styles.th}>#</th>
                <th className={styles.th}>Team</th>
                <th className={styles.thCenter}>Seed</th>
                <th className={styles.thRight}>Prob</th>
                <th className={styles.thBar} />
              </tr>
            </thead>
            <tbody>
              {simulationResult.topChampions
                .slice(0, 10)
                .map((entry, index) => {
                  const team = teams.get(entry.teamId);
                  const tEntry = team?.tournamentEntry;
                  return (
                    <tr
                      key={entry.teamId}
                      className={index === 0 ? styles.trFirst : styles.tr}
                    >
                      <td className={styles.tdRank}>{index + 1}</td>
                      <td className={styles.tdTeam}>
                        {team?.team.name ?? entry.teamId}
                      </td>
                      <td className={styles.tdSeed}>{tEntry?.seed ?? "-"}</td>
                      <td className={styles.tdProb}>
                        {(entry.probability * 100).toFixed(1)}%
                      </td>
                      <td className={styles.tdBar}>
                        <ProbabilityBar
                          probability={topMaxProb > 0 ? entry.probability / topMaxProb : 0}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Right column: upset rates + metadata */}
        <div>
          <div className={styles.sectionLabel}>Upset Rates by Round</div>
          <div className={styles.upsetList}>
            {ROUND_ORDER.map((round) => {
              const rate = simulationResult.upsetRates[round];
              if (rate === undefined) return null;
              return (
                <div key={round} className={styles.upsetRow}>
                  <span className={styles.upsetLabel}>
                    {ROUND_LABELS[round]}
                  </span>
                  <span className={styles.upsetValue}>
                    {(rate * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Metadata */}
          <div className={styles.sectionLabel}>Simulation Info</div>
          <div className={styles.metaText}>
            <div>
              Simulations:{" "}
              <span className={styles.metaValue}>
                {simulationResult.numSimulations.toLocaleString()}
              </span>
            </div>
            <div>
              Time:{" "}
              <span className={styles.metaValue}>
                {simulationResult.executionTimeMs < 1000
                  ? `${simulationResult.executionTimeMs}ms`
                  : `${(simulationResult.executionTimeMs / 1000).toFixed(1)}s`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
