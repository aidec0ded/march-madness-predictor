"use client";

import { useBracket } from "@/hooks/useBracket";
import { ProbabilityBar } from "@/components/bracket/ProbabilityBar";
import type { TournamentRound } from "@/types/team";

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

  return (
    <div
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border-primary)",
        padding: "16px 24px",
        animation: "slideDown 0.2s ease-out",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "0.875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-primary)",
            }}
          >
            Simulation Results
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              lineHeight: 1.4,
              fontWeight: 400,
            }}
          >
            Based on {simulationResult.numSimulations.toLocaleString()} full-bracket
            simulations using your current lever settings. Path probabilities account
            for all possible matchup combinations.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close results"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "1.25rem",
            lineHeight: 1,
            padding: "4px",
            flexShrink: 0,
          }}
        >
          &times;
        </button>
      </div>

      {/* Stale results banner */}
      {state.isSimulationStale && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            backgroundColor: "rgba(255, 193, 7, 0.1)",
            border: "1px solid var(--accent-warning)",
            color: "var(--accent-warning)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            marginBottom: "12px",
          }}
        >
          Results may be outdated — re-run simulation to reflect your latest changes.
        </div>
      )}

      {/* Content grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Most likely champion */}
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "8px",
            }}
          >
            Most Likely Champion
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "4px",
            }}
          >
            {championEntry && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  backgroundColor: "var(--accent-primary)",
                  color: "#ffffff",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                }}
              >
                {championEntry.seed}
              </span>
            )}
            <span
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {championTeam?.team.name ?? champion.teamId}
            </span>
          </div>
          <div
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--accent-success)",
            }}
          >
            {(champion.probability * 100).toFixed(1)}%
          </div>
        </div>

        {/* Top 10 champions table */}
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "8px",
            }}
          >
            Top 10 Championship Contenders
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8125rem",
            }}
          >
            <thead>
              <tr
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.6875rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 8px",
                    fontWeight: 600,
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "4px 8px",
                    fontWeight: 600,
                  }}
                >
                  Team
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "4px 8px",
                    fontWeight: 600,
                    width: "40px",
                  }}
                >
                  Seed
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "4px 8px",
                    fontWeight: 600,
                    width: "60px",
                  }}
                >
                  Prob
                </th>
                <th
                  style={{
                    padding: "4px 8px",
                    width: "120px",
                  }}
                />
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
                      style={{
                        borderTop:
                          index === 0
                            ? "none"
                            : "1px solid var(--border-primary)",
                      }}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          color: "var(--text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {team?.team.name ?? entry.teamId}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "center",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {tEntry?.seed ?? "-"}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {(entry.probability * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <ProbabilityBar probability={entry.probability * 5} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Right column: upset rates + metadata */}
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "8px",
            }}
          >
            Upset Rates by Round
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginBottom: "16px",
            }}
          >
            {ROUND_ORDER.map((round) => {
              const rate = simulationResult.upsetRates[round];
              if (rate === undefined) return null;
              return (
                <div
                  key={round}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8125rem",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)" }}>
                    {ROUND_LABELS[round]}
                  </span>
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {(rate * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Metadata */}
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "8px",
            }}
          >
            Simulation Info
          </div>
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            <div>
              Simulations:{" "}
              <span
                style={{
                  color: "var(--text-primary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {simulationResult.numSimulations.toLocaleString()}
              </span>
            </div>
            <div>
              Time:{" "}
              <span
                style={{
                  color: "var(--text-primary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {simulationResult.executionTimeMs < 1000
                  ? `${simulationResult.executionTimeMs}ms`
                  : `${(simulationResult.executionTimeMs / 1000).toFixed(1)}s`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Inline animation keyframes */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
