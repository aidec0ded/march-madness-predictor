"use client";

/**
 * Hook for managing AI matchup narrative generation.
 *
 * Handles:
 * - Building NarrativeRequest from matchup analysis + pool context
 * - Client-side caching (module-level Map keyed by data hash)
 * - Streaming fetch via SSE to POST /api/narrative
 * - Abort on unmount / gameId change
 * - Error handling with retry support
 *
 * Usage:
 * ```tsx
 * const { state, generate, reset } = useMatchupNarrative(analysis, teamA, teamB);
 * ```
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useContestStrategy } from "@/hooks/useContestStrategy";
import { hashNarrativeInput } from "@/lib/narrative/prompt-builder";
import type { TeamSeason } from "@/types/team";
import type { MatchupAnalysis } from "@/types/matchup-view";
import type { MatchupOverrides } from "@/types/engine";
import type {
  NarrativeState,
  NarrativeRequest,
  NarrativeTeamData,
} from "@/types/narrative";

// ---------------------------------------------------------------------------
// Client-side cache (persists for page session)
// ---------------------------------------------------------------------------

const narrativeCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serializes a TeamSeason into NarrativeTeamData for the request.
 */
function serializeTeamData(team: TeamSeason): NarrativeTeamData {
  return {
    name: team.team.shortName,
    seed: team.tournamentEntry?.seed ?? 0,
    region: team.tournamentEntry?.region ?? "Unknown",
    conference: team.team.conference,

    kenpomAdjOE: team.ratings.kenpom?.adjOE,
    kenpomAdjDE: team.ratings.kenpom?.adjDE,
    kenpomAdjEM: team.ratings.kenpom?.adjEM,
    torvikAdjOE: team.ratings.torvik?.adjOE,
    torvikAdjDE: team.ratings.torvik?.adjDE,
    torvikAdjEM: team.ratings.torvik?.adjEM,
    miyaBPR: team.ratings.evanmiya?.adjEM,

    offEfgPct: team.fourFactorsOffense.efgPct,
    offToPct: team.fourFactorsOffense.toPct,
    offOrbPct: team.fourFactorsOffense.orbPct,
    offFtRate: team.fourFactorsOffense.ftRate,

    defEfgPct: team.fourFactorsDefense?.efgPct ?? 0,
    defToPct: team.fourFactorsDefense?.toPct ?? 0,
    defOrbPct: team.fourFactorsDefense?.orbPct ?? 0,
    defFtRate: team.fourFactorsDefense?.ftRate ?? 0,

    offThreePtPct: team.shootingOffense.threePtPct,
    offThreePtRate: team.shootingOffense.threePtRate,
    offFtPct: team.shootingOffense.ftPct,
    defThreePtPct: team.shootingDefense?.threePtPct ?? 0,
    defThreePtRate: team.shootingDefense?.threePtRate ?? 0,

    adjTempo: team.adjTempo,
    avgPossLengthOff: team.avgPossLengthOff,
    avgPossLengthDef: team.avgPossLengthDef,

    experience: team.experience,
    minutesContinuity: team.minutesContinuity,
    benchMinutesPct: team.benchMinutesPct,
    avgHeight: team.avgHeight,

    twoFoulParticipation: team.twoFoulParticipation,

    sosNetRating: team.sosNetRating,
    luck: team.luck,

    coachName: team.coach.name,
    coachTournamentWins: team.coach.tournamentWins,
    coachTournamentGames: team.coach.tournamentGames,
    coachFinalFours: team.coach.finalFours,
    coachChampionships: team.coach.championships,
    coachYearsHC: team.coach.yearsHeadCoach,
  };
}

// ---------------------------------------------------------------------------
// Hook Return Type
// ---------------------------------------------------------------------------

export interface UseMatchupNarrativeResult {
  /** Current narrative state */
  state: NarrativeState;
  /** Trigger narrative generation */
  generate: () => void;
  /** Reset to idle state */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages AI matchup narrative lifecycle for a given matchup.
 *
 * @param analysis - The computed matchup analysis (null if teams not resolved)
 * @param teamA - Resolved team A
 * @param teamB - Resolved team B
 * @returns State, generate function, and reset function
 */
export function useMatchupNarrative(
  analysis: MatchupAnalysis | null,
  teamA: TeamSeason | null,
  teamB: TeamSeason | null
): UseMatchupNarrativeResult {
  const { state: bracketState } = useBracket();
  const {
    getEffectiveOwnership,
    getRecommendation,
    poolSizeBucket,
    poolConfig,
  } = useContestStrategy();

  const [narrativeState, setNarrativeState] = useState<NarrativeState>({
    status: "idle",
    text: "",
  });

  // Abort controller ref for cleanup
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Reset when gameId changes
  useEffect(() => {
    abortRef.current?.abort();
    setNarrativeState({ status: "idle", text: "" });
  }, [analysis?.gameId]);

  /**
   * Build the NarrativeRequest from current analysis and context.
   */
  const buildRequest = useCallback((): NarrativeRequest | null => {
    if (!analysis || !teamA || !teamB) return null;

    const overrides: MatchupOverrides | undefined =
      bracketState.matchupOverrides[analysis.gameId];

    const [ownershipA, ownershipB] = getEffectiveOwnership(
      analysis.gameId,
      teamA.teamId,
      teamB.teamId,
      analysis.round
    );

    const recA = getRecommendation(analysis.probA, ownershipA);
    const recB = getRecommendation(analysis.probB, ownershipB);

    return {
      gameId: analysis.gameId,
      round: analysis.round,
      teamAData: serializeTeamData(teamA),
      teamBData: serializeTeamData(teamB),
      probA: analysis.probA,
      spread: analysis.spread,
      breakdown: analysis.rawBreakdown,
      overrides,
      poolSizeBucket,
      ownershipA,
      ownershipB,
      leverageA: recA.leverageScore,
      leverageB: recB.leverageScore,
      poolDescription: poolConfig.description,
    };
  }, [
    analysis,
    teamA,
    teamB,
    bracketState.matchupOverrides,
    getEffectiveOwnership,
    getRecommendation,
    poolSizeBucket,
    poolConfig,
  ]);

  /**
   * Trigger narrative generation.
   *
   * Checks cache first, then streams from API.
   */
  const generate = useCallback(async () => {
    const request = buildRequest();
    if (!request) return;

    // Check cache
    const hash = hashNarrativeInput(request);
    const cached = narrativeCache.get(hash);
    if (cached) {
      setNarrativeState({ status: "complete", text: cached });
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setNarrativeState({ status: "generating", text: "" });

    try {
      const response = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          (errorData as { error?: string }).error ??
          `Request failed with status ${response.status}`;
        setNarrativeState({ status: "error", text: "", error: message });
        return;
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        setNarrativeState({
          status: "error",
          text: "",
          error: "No response body",
        });
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const payload = JSON.parse(line.slice(6)) as {
              text?: string;
              done?: boolean;
              error?: string;
            };

            if (payload.error) {
              setNarrativeState({
                status: "error",
                text: accumulated,
                error: payload.error,
              });
              return;
            }

            if (payload.text) {
              accumulated += payload.text;
              setNarrativeState({ status: "generating", text: accumulated });
            }

            if (payload.done) {
              narrativeCache.set(hash, accumulated);
              setNarrativeState({ status: "complete", text: accumulated });
              return;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Stream ended without explicit done signal — treat as complete
      if (accumulated) {
        narrativeCache.set(hash, accumulated);
        setNarrativeState({ status: "complete", text: accumulated });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Request was aborted (user navigated away) — don't update state
        return;
      }

      const message =
        err instanceof Error ? err.message : "Failed to generate narrative";
      setNarrativeState({ status: "error", text: "", error: message });
    }
  }, [buildRequest]);

  /**
   * Reset to idle state and clear any in-flight requests.
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setNarrativeState({ status: "idle", text: "" });
  }, []);

  return {
    state: narrativeState,
    generate,
    reset,
  };
}
