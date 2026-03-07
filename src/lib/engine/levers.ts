/**
 * Global lever system for the March Madness probability engine.
 *
 * Levers allow users to adjust how much weight specific factors carry
 * in the probability calculation beyond raw efficiency ratings. There are
 * two categories:
 *
 * **Mean-adjusting levers** shift the expected outcome (efficiency point adjustment):
 * - Four Factors comparison (8 sub-factors)
 * - Roster experience
 * - Minutes continuity
 * - Coach tournament experience
 *
 * **Variance-adjusting levers** widen or compress the outcome distribution (multiplier):
 * - Pace / Tempo
 * - Three-Point Rate
 *
 * All functions are pure (no side effects) and return either an efficiency
 * point adjustment (positive favors team A) or a variance multiplier.
 */

import type { TeamSeason } from "@/types/team";
import type { FourFactorsLeverWeights } from "@/types/engine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Scaling factor for converting Four Factors percentage differences into efficiency points */
const FOUR_FACTORS_SCALING = 0.15;

/** Efficiency points per 1 year of experience difference at default weight */
const EXPERIENCE_SCALING = 0.75;

/** Efficiency points per percentage point of continuity difference */
const CONTINUITY_SCALING = 0.05;

/** Efficiency points per 0.20 (20 percentage points) of coach win-rate difference */
const COACH_WIN_RATE_SCALING = 5.0;

/** Efficiency points per Final Four appearance (capped) */
const COACH_FINAL_FOUR_BONUS = 0.1;

/** Maximum cumulative Final Four bonus (efficiency points) */
const COACH_FINAL_FOUR_CAP = 1.0;

/** Minimum tournament games before a coach's win rate is considered reliable */
const COACH_MIN_GAMES = 5;

/** Default coach win rate when sample size is too small */
const COACH_DEFAULT_WIN_RATE = 0.5;

/** Baseline D1 average tempo (possessions per 40 minutes) */
const BASELINE_TEMPO = 68;

/** How steeply tempo deviations affect variance */
const TEMPO_VARIANCE_SCALING = 0.015;

/** Minimum tempo variance multiplier (floor) */
const TEMPO_VARIANCE_MIN = 0.7;

/** Maximum tempo variance multiplier (ceiling) */
const TEMPO_VARIANCE_MAX = 1.4;

/** Baseline D1 average three-point attempt rate (%) */
const BASELINE_THREE_PT_RATE = 35;

/** How steeply 3PT rate deviations affect variance */
const THREE_PT_VARIANCE_SCALING = 0.02;

/** Minimum 3PT variance multiplier (floor) */
const THREE_PT_VARIANCE_MIN = 0.8;

/** Maximum 3PT variance multiplier (ceiling) */
const THREE_PT_VARIANCE_MAX = 1.5;

// ---------------------------------------------------------------------------
// Mean-adjusting levers
// ---------------------------------------------------------------------------

/**
 * Calculates the Four Factors efficiency point adjustment between two teams.
 *
 * Compares each of the 8 Four Factors (4 offensive, 4 defensive) between teams.
 * For each factor, the advantage is computed by comparing team A's offense vs
 * team B's defense and vice versa, then differencing. The raw advantage is
 * scaled into efficiency points using a scaling constant of 0.15.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weights - Per-factor lever weights (0 = ignore, 1 = default, 2 = double)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateFourFactorsAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weights: FourFactorsLeverWeights
): number {
  let totalAdjustment = 0;

  // --- eFG% ---
  // Team A's offense vs Team B's defense
  const efgAdvA =
    (teamA.fourFactorsOffense.efgPct - teamB.fourFactorsDefense.efgPct) *
    weights.efgPctOffense;
  // Team B's offense vs Team A's defense (subtract because B's advantage hurts A)
  const efgAdvB =
    (teamB.fourFactorsOffense.efgPct - teamA.fourFactorsDefense.efgPct) *
    weights.efgPctDefense;
  totalAdjustment += efgAdvA - efgAdvB;

  // --- Turnover % ---
  // NOTE: Lower TO% is better for offense, higher TO% forced is better for defense.
  // Team A's offense vs Team B's defense:
  //   B's defensive TO% (forced) minus A's offensive TO% (committed)
  //   Positive means B forces more turnovers than A commits -> bad for A
  //   So we flip: A's advantage = A's low TO rate - B's forced TO rate (negative = bad)
  //   Actually: advantage for A = (teamB.fourFactorsDefense.toPct - teamA.fourFactorsOffense.toPct)
  //   Wait — if B forces a high TO%, that's *bad* for A. So A's matchup advantage on the
  //   offensive end is when A has low turnovers *and* B doesn't force many.
  //   advantage_A_off = (teamB.fourFactorsDefense.toPct - teamA.fourFactorsOffense.toPct)
  //   This is WRONG — if B's defense forces 22% TOs and A commits 18%, then (22-18) = +4
  //   means B is forcing 4% more than A gives up on average -> bad for A.
  //   So A's advantage on offense = A's low TO minus B's high forced = negative of (B_def - A_off).
  //   Simplify: A_off advantage = teamA.fourFactorsOffense.toPct subtracted from norm.
  //   Per the spec: advantage = (teamB.def.toPct - teamA.off.toPct) * weight
  //   This means: if B's defense doesn't force many TOs (low value) and A commits few (low value),
  //   the difference is small. If B forces a lot (high) and A commits few (low), the value is
  //   positive. But that's bad for A — B's defense is tough.
  //   The spec says: "TO% advantage: (teamB.fourFactorsDefense.toPct - teamA.fourFactorsOffense.toPct) * weight"
  //   This gives a positive value when B's defense forces more TOs than A's offense commits
  //   on average — that should be NEGATIVE for A (bad for A's offense).
  //   BUT then we subtract the symmetric version. Let's follow the spec literally:
  const toAdvA =
    (teamB.fourFactorsDefense.toPct - teamA.fourFactorsOffense.toPct) *
    weights.toPctOffense;
  const toAdvB =
    (teamA.fourFactorsDefense.toPct - teamB.fourFactorsOffense.toPct) *
    weights.toPctDefense;
  totalAdjustment += toAdvA - toAdvB;

  // --- Offensive Rebound % ---
  // Team A's ORB offense vs Team B's defensive rebounding
  const orbAdvA =
    (teamA.fourFactorsOffense.orbPct - teamB.fourFactorsDefense.orbPct) *
    weights.orbPctOffense;
  const orbAdvB =
    (teamB.fourFactorsOffense.orbPct - teamA.fourFactorsDefense.orbPct) *
    weights.orbPctDefense;
  totalAdjustment += orbAdvA - orbAdvB;

  // --- Free Throw Rate ---
  // Team A's ability to get to the line vs Team B's ability to prevent it
  const ftrAdvA =
    (teamA.fourFactorsOffense.ftRate - teamB.fourFactorsDefense.ftRate) *
    weights.ftRateOffense;
  const ftrAdvB =
    (teamB.fourFactorsOffense.ftRate - teamA.fourFactorsDefense.ftRate) *
    weights.ftRateDefense;
  totalAdjustment += ftrAdvA - ftrAdvB;

  // Scale the raw percentage-point comparison into efficiency points
  return totalAdjustment * FOUR_FACTORS_SCALING;
}

/**
 * Calculates the experience-based efficiency point adjustment.
 *
 * Compares minutes-weighted D-1 experience between teams.
 * 1 year of experience difference equals approximately 0.75 efficiency points
 * at default weight.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default, 2 = double)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateExperienceAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  return (teamA.experience - teamB.experience) * EXPERIENCE_SCALING * weight;
}

/**
 * Calculates the minutes continuity efficiency point adjustment.
 *
 * Compares minutes continuity percentages between teams.
 * 10 percentage points of continuity difference equals approximately
 * 0.5 efficiency points at default weight.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default, 2 = double)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateContinuityAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  return (
    (teamA.minutesContinuity - teamB.minutesContinuity) *
    CONTINUITY_SCALING *
    weight
  );
}

/**
 * Calculates the coach tournament experience efficiency point adjustment.
 *
 * Uses coach tournament win percentage and Final Four appearances to derive
 * a coaching score. If a coach has fewer than 5 tournament games, their
 * win rate defaults to 0.5 (neutral). Each Final Four appearance adds a
 * small bonus capped at 1.0 efficiency points.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default, 2 = double)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateCoachAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  const scoreA = computeCoachScore(teamA.coach);
  const scoreB = computeCoachScore(teamB.coach);
  return (scoreA - scoreB) * weight;
}

/**
 * Computes a single coach's tournament experience score in efficiency points.
 *
 * @param coach - The coach record
 * @returns A score in efficiency points
 */
function computeCoachScore(coach: TeamSeason["coach"]): number {
  // Win rate component
  const winRate =
    coach.tournamentGames >= COACH_MIN_GAMES
      ? coach.tournamentWins / coach.tournamentGames
      : COACH_DEFAULT_WIN_RATE;

  // Scale win rate to efficiency points:
  // 20 percentage point win rate advantage ~ 1.0 efficiency point
  // So raw score = winRate * COACH_WIN_RATE_SCALING
  const winRateScore = winRate * COACH_WIN_RATE_SCALING;

  // Final Four bonus (capped)
  const finalFourBonus = Math.min(
    coach.finalFours * COACH_FINAL_FOUR_BONUS,
    COACH_FINAL_FOUR_CAP
  );

  return winRateScore + finalFourBonus;
}

// ---------------------------------------------------------------------------
// Variance-adjusting levers
// ---------------------------------------------------------------------------

/**
 * Calculates the tempo-based variance multiplier for a matchup.
 *
 * Averages the two teams' adjusted tempo and compares to the D1 baseline
 * of 68 possessions per 40 minutes. Slower games compress outcomes
 * (multiplier < 1), while faster games expand them (multiplier > 1).
 *
 * Clamped to [0.7, 1.4].
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = no tempo effect, 1 = default)
 * @returns Variance multiplier (1.0 = no change)
 */
export function calculateTempoVarianceMultiplier(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  const avgTempo = (teamA.adjTempo + teamB.adjTempo) / 2;
  const rawMultiplier =
    1.0 + (avgTempo - BASELINE_TEMPO) * TEMPO_VARIANCE_SCALING * weight;
  return Math.max(
    TEMPO_VARIANCE_MIN,
    Math.min(TEMPO_VARIANCE_MAX, rawMultiplier)
  );
}

/**
 * Calculates the three-point rate variance multiplier for a matchup.
 *
 * Averages the two teams' three-point attempt rate (3PA/FGA) and compares
 * to the D1 baseline of 35%. Teams that rely heavily on threes introduce
 * boom/bust variance (multiplier > 1), while low-volume three-point teams
 * produce tighter distributions (multiplier < 1).
 *
 * Clamped to [0.8, 1.5].
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = no 3PT effect, 1 = default)
 * @returns Variance multiplier (1.0 = no change)
 */
export function calculateThreePtVarianceMultiplier(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  const avg3PtRate =
    (teamA.shootingOffense.threePtRate + teamB.shootingOffense.threePtRate) / 2;
  const rawMultiplier =
    1.0 +
    (avg3PtRate - BASELINE_THREE_PT_RATE) * THREE_PT_VARIANCE_SCALING * weight;
  return Math.max(
    THREE_PT_VARIANCE_MIN,
    Math.min(THREE_PT_VARIANCE_MAX, rawMultiplier)
  );
}
