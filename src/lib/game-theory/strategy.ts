/**
 * Strategy engine for pool-size-aware recommendations.
 *
 * Combines win probability with ownership estimates to produce
 * leverage-based recommendations. The strategy adapts based on
 * the pool size bucket:
 *
 * - Small pools:     Pure probability maximization
 * - Medium pools:    1-2 contrarian picks recommended
 * - Large pools:     Champion ownership is primary factor
 * - Very large pools: Lottery-style low-ownership paths
 *
 * The key concept is "leverage score": winProb / ownership.
 * A leverage score > 1.0 means the team is under-owned relative to
 * their probability — a contrarian value opportunity.
 */

import type {
  EdgeAnalysis,
  PoolSizeBucket,
  PoolStrategyConfig,
  RecommendationType,
  StrategyRecommendation,
} from "@/types/game-theory";
import type { TournamentRound } from "@/types/team";

// ---------------------------------------------------------------------------
// Pool Strategy Configurations
// ---------------------------------------------------------------------------

/**
 * Strategy configurations for each pool size tier.
 *
 * - ownershipFactor: 0 = ignore ownership entirely, 1 = ownership dominates
 * - contrarianThreshold: leverage score above which a pick is "contrarian value"
 * - avoidThreshold: leverage score below which a pick is "avoid" (over-owned)
 */
export const POOL_STRATEGY_CONFIGS: Record<PoolSizeBucket, PoolStrategyConfig> =
  {
    small: {
      bucket: "small",
      label: "Small (≤20)",
      ownershipFactor: 0,
      contrarianThreshold: 999, // effectively never triggers
      avoidThreshold: 0, // effectively never triggers
      description:
        "Maximize raw probability. In a small pool, differentiation matters less — pick the most likely outcomes.",
    },
    medium: {
      bucket: "medium",
      label: "Medium (50–200)",
      ownershipFactor: 0.3,
      contrarianThreshold: 1.5,
      avoidThreshold: 0.5,
      description:
        "Mostly chalk with 1-2 strategically contrarian picks. Balance probability with differentiation.",
    },
    large: {
      bucket: "large",
      label: "Large (500+)",
      ownershipFactor: 0.6,
      contrarianThreshold: 1.3,
      avoidThreshold: 0.6,
      description:
        "Champion ownership is a primary consideration. Seek low-ownership + defensible picks to differentiate.",
    },
    very_large: {
      bucket: "very_large",
      label: "Very Large (100K+)",
      ownershipFactor: 0.8,
      contrarianThreshold: 1.2,
      avoidThreshold: 0.7,
      description:
        "Lottery-style strategy. Maximize expected uniqueness over raw probability. Low-ownership paths are essential.",
    },
  };

// ---------------------------------------------------------------------------
// Leverage Score
// ---------------------------------------------------------------------------

/**
 * Calculates the leverage score for a pick.
 *
 * Leverage = winProbability / (ownershipPct / 100)
 *
 * A leverage score of:
 * - 1.0 = fair value (probability matches ownership)
 * - > 1.0 = under-owned (contrarian value)
 * - < 1.0 = over-owned (the public likes this pick more than the data supports)
 *
 * @param winProbability - The team's win probability (0-1)
 * @param ownershipPct - The estimated public ownership (0-100)
 * @returns The leverage score (0 to Infinity, practically 0-10)
 */
export function calculateLeverageScore(
  winProbability: number,
  ownershipPct: number
): number {
  // Guard against division by zero
  if (ownershipPct <= 0) return winProbability > 0 ? 10 : 0;
  return winProbability / (ownershipPct / 100);
}

// ---------------------------------------------------------------------------
// Strategy Recommendation
// ---------------------------------------------------------------------------

/**
 * Generates a strategy recommendation for a specific pick.
 *
 * Uses the leverage score and pool strategy config to determine:
 * - max_probability:   Small pool — just pick the best probability
 * - contrarian_value:  Under-owned team with solid probability
 * - slight_contrarian: Moderately under-owned team
 * - avoid:             Over-owned team (public over-picks relative to probability)
 * - neutral:           Neither especially contrarian nor over-owned
 *
 * @param winProbability - The team's win probability (0-1)
 * @param ownershipPct - The estimated public ownership (0-100)
 * @param poolConfig - The pool strategy configuration
 * @returns The recommendation type with explanation
 */
export function getStrategyRecommendation(
  winProbability: number,
  ownershipPct: number,
  poolConfig: PoolStrategyConfig
): { type: RecommendationType; leverageScore: number; reason: string } {
  const leverageScore = calculateLeverageScore(winProbability, ownershipPct);

  // Small pool: always maximize probability
  if (poolConfig.ownershipFactor === 0) {
    return {
      type: "max_probability",
      leverageScore,
      reason:
        "In a small pool, pick the most likely outcome. Differentiation matters less.",
    };
  }

  // Contrarian value: high leverage score
  if (leverageScore >= poolConfig.contrarianThreshold) {
    return {
      type: "contrarian_value",
      leverageScore,
      reason: `Under-owned at ${ownershipPct.toFixed(0)}% — leverage score ${leverageScore.toFixed(2)} suggests contrarian value.`,
    };
  }

  // Avoid: low leverage score (over-owned)
  if (leverageScore <= poolConfig.avoidThreshold) {
    return {
      type: "avoid",
      leverageScore,
      reason: `Over-owned at ${ownershipPct.toFixed(0)}% relative to ${(winProbability * 100).toFixed(0)}% win probability — leverage score ${leverageScore.toFixed(2)}.`,
    };
  }

  // Slight contrarian: moderately above 1.0
  if (leverageScore >= 1.15) {
    return {
      type: "slight_contrarian",
      leverageScore,
      reason: `Slightly under-owned — leverage score ${leverageScore.toFixed(2)} offers modest differentiation.`,
    };
  }

  // Neutral: close to fair value
  return {
    type: "neutral",
    leverageScore,
    reason: `Ownership roughly matches probability — leverage score ${leverageScore.toFixed(2)}.`,
  };
}

/**
 * Builds a full strategy recommendation for a team in a specific game.
 *
 * @param teamId - The team ID
 * @param gameId - The game ID
 * @param round - The tournament round
 * @param winProbability - The team's win probability (0-1)
 * @param ownershipPct - The estimated public ownership (0-100)
 * @param poolConfig - The pool strategy configuration
 * @returns A complete StrategyRecommendation
 */
export function buildStrategyRecommendation(
  teamId: string,
  gameId: string,
  round: TournamentRound,
  winProbability: number,
  ownershipPct: number,
  poolConfig: PoolStrategyConfig
): StrategyRecommendation {
  const { type, leverageScore, reason } = getStrategyRecommendation(
    winProbability,
    ownershipPct,
    poolConfig
  );

  return {
    teamId,
    gameId,
    round,
    type,
    leverageScore,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Round-Aware Thresholds
// ---------------------------------------------------------------------------

/**
 * Round multipliers applied to the contrarian threshold. Later rounds
 * are more impactful, so the threshold is effectively *lowered*
 * (dividing by a larger multiplier) to surface more edges.
 */
export const ROUND_THRESHOLD_MULTIPLIER: Record<TournamentRound, number> = {
  FF: 0.5, // First Four — low value
  R64: 0.6, // Round of 64 — low value, high damage risk
  R32: 0.75, // Round of 32
  S16: 1.0, // Sweet 16 — baseline
  E8: 1.25, // Elite 8 — high value
  F4: 1.5, // Final Four — very high value
  NCG: 2.0, // Championship — THE differentiator
};

/**
 * Minimum win probability required before we will recommend the
 * underdog, regardless of leverage. Varies by pool size — larger
 * pools tolerate more risk.
 */
export const PROBABILITY_FLOOR: Record<PoolSizeBucket, number> = {
  small: 0.45, // Only recommend near coin-flips
  medium: 0.35, // Moderate floor
  large: 0.3, // Lower floor
  very_large: 0.25, // Accept more risk
};

// ---------------------------------------------------------------------------
// Matchup Edge Analysis
// ---------------------------------------------------------------------------

/**
 * Analyses a matchup between two teams and returns a structured edge
 * assessment that accounts for round importance and pool size.
 *
 * The key insight: an edge only exists when the *lower-probability* team
 * has the *higher* leverage score. If the favourite is also under-owned,
 * there's no contrarian edge to surface — they're the obvious pick.
 *
 * @param winProbA   - Team A's win probability (0-1). Team B's is `1 - winProbA`.
 * @param ownershipA - Team A's estimated public ownership (0-100).
 * @param ownershipB - Team B's estimated public ownership (0-100).
 * @param round      - The tournament round for this matchup.
 * @param poolConfig - The pool strategy configuration.
 * @returns A complete {@link EdgeAnalysis}.
 */
export function getMatchupEdgeAnalysis(
  winProbA: number,
  ownershipA: number,
  ownershipB: number,
  round: TournamentRound,
  poolConfig: PoolStrategyConfig
): EdgeAnalysis {
  const winProbB = 1 - winProbA;

  const leverageA = calculateLeverageScore(winProbA, ownershipA);
  const leverageB = calculateLeverageScore(winProbB, ownershipB);

  const roundMultiplier = ROUND_THRESHOLD_MULTIPLIER[round];
  const effectiveThreshold =
    poolConfig.contrarianThreshold / roundMultiplier;

  // Determine which team has higher leverage
  const higherLevTeam: "A" | "B" = leverageA >= leverageB ? "A" : "B";
  const higherLevProb = higherLevTeam === "A" ? winProbA : winProbB;
  const lowerLevProb = higherLevTeam === "A" ? winProbB : winProbA;
  const higherLevScore = higherLevTeam === "A" ? leverageA : leverageB;

  // Base result with no edge
  const base: EdgeAnalysis = {
    leverageTeamId: null,
    leverageA,
    leverageB,
    isActionable: false,
    effectiveThreshold,
    edgeLabel: null,
    edgeDescription: null,
  };

  // If the higher-leverage team is already the higher-probability team,
  // there's no contrarian edge — they're the obvious pick.
  if (higherLevProb >= lowerLevProb) {
    return base;
  }

  // The higher-leverage team is the underdog. Check actionability:
  // 1. Win probability must exceed the floor for this pool size
  const floor = PROBABILITY_FLOOR[poolConfig.bucket];
  if (higherLevProb < floor) {
    return { ...base, leverageTeamId: higherLevTeam };
  }

  // 2. Leverage must exceed the effective threshold
  if (higherLevScore < effectiveThreshold) {
    return { ...base, leverageTeamId: higherLevTeam };
  }

  // Edge is actionable — determine label and description
  const isStrong = higherLevScore >= effectiveThreshold * 1.5;
  const edgeLabel = isStrong ? "Strong Edge" : "Strategic Edge";

  const teamLabel = `Team ${higherLevTeam}`;
  const probPct = (higherLevProb * 100).toFixed(0);
  const edgeDescription = isStrong
    ? `${teamLabel} has a ${probPct}% win probability but is significantly under-owned (leverage ${higherLevScore.toFixed(2)}). In ${poolConfig.label} pools, this is a high-value contrarian pick for the ${round}.`
    : `${teamLabel} has a ${probPct}% win probability and is under-owned relative to their chances (leverage ${higherLevScore.toFixed(2)}). Worth considering as a strategic differentiator in the ${round}.`;

  return {
    leverageTeamId: higherLevTeam,
    leverageA,
    leverageB,
    isActionable: true,
    effectiveThreshold,
    edgeLabel,
    edgeDescription,
  };
}
