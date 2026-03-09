"use client";

/**
 * Hook for computing full matchup analysis data.
 *
 * Given a gameId, resolves the two teams from bracket state, runs the
 * probability engine with and without overrides, generates a Monte Carlo
 * distribution histogram, and returns a complete MatchupAnalysis object
 * ready for the matchup view UI.
 */

import { useMemo } from "react";
import { useBracket } from "@/hooks/useBracket";
import { resolveMatchupTeams } from "@/lib/bracket-utils";
import { resolveMatchup } from "@/lib/engine/matchup";
import { ratingDiffToSpread } from "@/lib/engine/win-probability";
import { generateMatchupDistribution } from "@/lib/engine/distribution";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { TeamSeason } from "@/types/team";
import type { BracketMatchup } from "@/types/simulation";
import type {
  MatchupAnalysis,
  ProbabilityBreakdownDisplay,
  StatCategory,
} from "@/types/matchup-view";

// ---------------------------------------------------------------------------
// Pre-built matchup lookup
// ---------------------------------------------------------------------------

const ALL_MATCHUPS = buildBracketMatchups();
const MATCHUP_MAP = new Map<string, BracketMatchup>(
  ALL_MATCHUPS.map((m) => [m.gameId, m])
);

// ---------------------------------------------------------------------------
// Stat builder
// ---------------------------------------------------------------------------

/**
 * Builds the stat comparison categories for two teams.
 *
 * @param teamA - First team
 * @param teamB - Second team
 * @returns Array of StatCategory objects for the comparison display
 */
export function buildStatCategories(
  teamA: TeamSeason,
  teamB: TeamSeason
): StatCategory[] {
  const kenpomA = teamA.ratings.kenpom;
  const kenpomB = teamB.ratings.kenpom;

  return [
    // Efficiency
    {
      label: "Adj. Off. Efficiency",
      valueA: kenpomA?.adjOE ?? null,
      valueB: kenpomB?.adjOE ?? null,
      higherIsBetter: true,
      format: "decimal",
      group: "efficiency",
    },
    {
      label: "Adj. Def. Efficiency",
      valueA: kenpomA?.adjDE ?? null,
      valueB: kenpomB?.adjDE ?? null,
      higherIsBetter: false,
      format: "decimal",
      group: "efficiency",
    },
    // Four Factors
    {
      label: "eFG% (Off)",
      valueA: teamA.fourFactorsOffense.efgPct,
      valueB: teamB.fourFactorsOffense.efgPct,
      higherIsBetter: true,
      format: "pct",
      group: "four_factors",
    },
    {
      label: "eFG% (Def)",
      valueA: teamA.fourFactorsDefense.efgPct,
      valueB: teamB.fourFactorsDefense.efgPct,
      higherIsBetter: false,
      format: "pct",
      group: "four_factors",
    },
    {
      label: "TO% (Off)",
      valueA: teamA.fourFactorsOffense.toPct,
      valueB: teamB.fourFactorsOffense.toPct,
      higherIsBetter: false,
      format: "pct",
      group: "four_factors",
    },
    {
      label: "TO% (Def)",
      valueA: teamA.fourFactorsDefense.toPct,
      valueB: teamB.fourFactorsDefense.toPct,
      higherIsBetter: true,
      format: "pct",
      group: "four_factors",
    },
    {
      label: "ORB% (Off)",
      valueA: teamA.fourFactorsOffense.orbPct,
      valueB: teamB.fourFactorsOffense.orbPct,
      higherIsBetter: true,
      format: "pct",
      group: "four_factors",
    },
    {
      label: "ORB% (Def)",
      valueA: teamA.fourFactorsDefense.orbPct,
      valueB: teamB.fourFactorsDefense.orbPct,
      higherIsBetter: false,
      format: "pct",
      group: "four_factors",
    },
    {
      label: "FT Rate (Off)",
      valueA: teamA.fourFactorsOffense.ftRate,
      valueB: teamB.fourFactorsOffense.ftRate,
      higherIsBetter: true,
      format: "decimal",
      group: "four_factors",
    },
    {
      label: "FT Rate (Def)",
      valueA: teamA.fourFactorsDefense.ftRate,
      valueB: teamB.fourFactorsDefense.ftRate,
      higherIsBetter: false,
      format: "decimal",
      group: "four_factors",
    },
    // Shooting
    {
      label: "3PT%",
      valueA: teamA.shootingOffense.threePtPct,
      valueB: teamB.shootingOffense.threePtPct,
      higherIsBetter: true,
      format: "pct",
      group: "shooting",
    },
    // Other
    {
      label: "Adj Tempo",
      valueA: teamA.adjTempo,
      valueB: teamB.adjTempo,
      higherIsBetter: true,
      format: "decimal",
      group: "other",
    },
    {
      label: "Experience",
      valueA: teamA.experience,
      valueB: teamB.experience,
      higherIsBetter: true,
      format: "decimal",
      group: "other",
    },
    {
      label: "Continuity",
      valueA: teamA.minutesContinuity,
      valueB: teamB.minutesContinuity,
      higherIsBetter: true,
      format: "pct",
      group: "other",
    },
    {
      label: "Avg Height",
      valueA: teamA.avgHeight,
      valueB: teamB.avgHeight,
      higherIsBetter: true,
      format: "decimal",
      group: "other",
    },
  ];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Return type for useMatchupAnalysis */
export interface UseMatchupAnalysisResult {
  /** The matchup analysis data (null if teams cannot be resolved) */
  analysis: MatchupAnalysis | null;
  /** Resolved team A (null if not determined yet) */
  teamA: TeamSeason | null;
  /** Resolved team B (null if not determined yet) */
  teamB: TeamSeason | null;
  /** Stat categories for the comparison display */
  stats: StatCategory[];
  /** The bracket matchup definition */
  matchup: BracketMatchup | null;
}

/**
 * Core hook for the matchup detail view.
 *
 * Given a gameId:
 * 1. Finds the matchup in the bracket matchup tree
 * 2. Resolves teams via resolveMatchupTeams()
 * 3. Runs resolveMatchup() with overrides for the adjusted result
 * 4. Runs resolveMatchup() without overrides for the baseline result
 * 5. Generates a Monte Carlo distribution histogram
 * 6. Returns a complete MatchupAnalysis object
 *
 * @param gameId - The unique game identifier (e.g., "R64-East-1")
 * @returns Analysis data, resolved teams, stat categories, and matchup definition
 */
export function useMatchupAnalysis(gameId: string | null): UseMatchupAnalysisResult {
  const { state } = useBracket();

  return useMemo(() => {
    if (!gameId) {
      return { analysis: null, teamA: null, teamB: null, stats: [], matchup: null };
    }

    const matchup = MATCHUP_MAP.get(gameId) ?? null;
    if (!matchup) {
      return { analysis: null, teamA: null, teamB: null, stats: [], matchup: null };
    }

    const { teamA, teamB } = resolveMatchupTeams(matchup, state.teams, state.picks);

    if (!teamA || !teamB) {
      return { analysis: null, teamA, teamB, stats: [], matchup };
    }

    // Build engine config from global levers
    const config = {
      ...DEFAULT_ENGINE_CONFIG,
      levers: state.globalLevers,
    };

    // Get per-matchup overrides
    const overrides = state.matchupOverrides[gameId];

    // Run matchup resolver WITH overrides
    const result = resolveMatchup(teamA, teamB, config, overrides);

    // Run matchup resolver WITHOUT overrides (baseline)
    const baseResult = resolveMatchup(teamA, teamB, config);

    // Build probability breakdown display items
    const breakdown: ProbabilityBreakdownDisplay[] = [
      {
        label: "Base Probability",
        value: result.breakdown.baseProbability,
        format: "probability",
      },
      {
        label: "Four Factors",
        value: result.breakdown.fourFactorsAdjustment,
        format: "adjustment",
      },
      {
        label: "Experience",
        value: result.breakdown.experienceAdjustment,
        format: "adjustment",
      },
      {
        label: "Continuity",
        value: result.breakdown.continuityAdjustment,
        format: "adjustment",
      },
      {
        label: "Coaching",
        value: result.breakdown.coachAdjustment,
        format: "adjustment",
      },
      {
        label: "Tempo Variance",
        value: result.breakdown.tempoVarianceMultiplier,
        format: "multiplier",
      },
      {
        label: "3PT Variance",
        value: result.breakdown.threePtVarianceMultiplier,
        format: "multiplier",
      },
    ];

    // Add override adjustments if present
    if (overrides) {
      const oa = result.breakdown.overrideAdjustments;
      if (oa.injury !== 0) {
        breakdown.push({ label: "Injury", value: oa.injury, format: "adjustment" });
      }
      if (oa.siteProximity !== 0) {
        breakdown.push({ label: "Site Proximity", value: oa.siteProximity, format: "adjustment" });
      }
      if (oa.recentForm !== 0) {
        breakdown.push({ label: "Recent Form", value: oa.recentForm, format: "adjustment" });
      }
      if (oa.rest !== 0) {
        breakdown.push({ label: "Rest", value: oa.rest, format: "adjustment" });
      }
    }

    // Calculate point spread from the adjusted rating differential
    const adjustedDiff =
      result.breakdown.ratingDifferential +
      result.breakdown.totalMeanAdjustment +
      result.breakdown.overrideAdjustments.total;
    const spread = ratingDiffToSpread(adjustedDiff);

    // Generate distribution histogram
    // Convert spread to actual points (spread is already in point terms from ratingDiffToSpread)
    // spread is negative when A is favored, so negate for the distribution generator
    // which expects positive = A favored
    const distribution = generateMatchupDistribution(-spread, 7.5);

    // Build stat categories
    const stats = buildStatCategories(teamA, teamB);

    const analysis: MatchupAnalysis = {
      gameId,
      round: matchup.round,
      probA: result.winProbabilityA,
      probB: result.winProbabilityB,
      baseProbA: baseResult.winProbabilityA,
      baseProbB: baseResult.winProbabilityB,
      spread,
      breakdown,
      distribution,
      rawBreakdown: result.breakdown,
    };

    return { analysis, teamA, teamB, stats, matchup };
  }, [gameId, state.teams, state.picks, state.globalLevers, state.matchupOverrides]);
}
