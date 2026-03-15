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
import type { FourFactorsLeverWeights, GameSiteCoordinates } from "@/types/engine";
import { haversineDistance } from "@/lib/geo";

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

/** Efficiency points per 1 unit of Miya opponent adjustment difference.
 *  Typical range is -60 to +60, so at 0.02 scaling a 60-point diff → 1.2 eff pts. */
const OPPONENT_ADJUST_SCALING = 0.02;

/** Efficiency points per 1 percentage point of bench minutes difference.
 *  At 0.08 scaling, a 10pp bench depth advantage → 0.8 eff pts. */
const BENCH_SCALING = 0.08;

/** Efficiency points per 1 unit of Miya pace adjustment difference.
 *  Typical range is -40 to +40, so at 0.03 scaling a 40-point diff → 1.2 eff pts. */
const PACE_ADJUST_SCALING = 0.03;

/**
 * Efficiency points per 1.0 SoS Net Rating point difference.
 * Conservative because adjusted efficiency ratings already incorporate SoS.
 * For a 10-point SoS differential (very large), yields ±1.0 eff pts.
 */
const SOS_SCALING = 0.10;

/**
 * Scaling for KenPom Luck regression.
 * Luck ranges roughly -0.08 to +0.16 in the tournament field.
 * At 8.0 scaling, +0.08 luck → -0.64 eff pt penalty.
 */
const LUCK_SCALING = 8.0;

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

/**
 * Maximum efficiency points for site proximity (true home court, ~0 miles).
 * Decays exponentially with distance.
 */
const SITE_PROXIMITY_MAX = 3.0;

/**
 * Distance decay rate for the exponential proximity model.
 * At 200 miles: ~1.6 eff pts. At 500 miles: ~0.5 eff pts. At 1000 miles: ~0.1 eff pts.
 */
const SITE_PROXIMITY_DECAY = 0.003;

/**
 * Small penalty for extreme travel (>1000 miles), in efficiency points.
 * Represents fatigue/disruption from cross-country travel.
 */
const SITE_PROXIMITY_TRAVEL_PENALTY = -0.5;

/** Distance threshold (miles) beyond which the travel penalty applies */
const SITE_PROXIMITY_TRAVEL_THRESHOLD = 1000;

// ---------------------------------------------------------------------------
// Mean-adjusting levers
// ---------------------------------------------------------------------------

/**
 * Calculates the Four Factors efficiency point adjustment between two teams.
 *
 * Uses a **same-team net quality** approach: for each factor, we compute each
 * team's net quality (offensive stat minus defensive stat for the same team),
 * then compare the two teams. This correctly captures that a team with elite
 * offense going against elite defense is a clash of strengths, not a guaranteed
 * advantage for the offense.
 *
 * For eFG%, ORB%, and FT Rate: higher offensive = better, lower defensive = better,
 * so net quality = (offense × offWeight) − (defense × defWeight).
 *
 * For TO%: lower offensive = better (fewer turnovers committed), higher defensive =
 * better (more turnovers forced), so the formula is inverted:
 * net quality = (defense × defWeight) − (offense × offWeight).
 *
 * When offense and defense weights are both 1.0 (default), the formula reduces
 * to: adjustment = (A_off − A_def) − (B_off − B_def) for each factor.
 * Users can then weight offense or defense more heavily via levers.
 *
 * If either team's defensive four factors are null (data not loaded), the
 * adjustment is 0 — we cannot compute a meaningful comparison without both
 * teams' offensive AND defensive data.
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
  // If either team's defensive four factors are missing, skip this adjustment
  if (!teamA.fourFactorsDefense || !teamB.fourFactorsDefense) {
    return 0;
  }

  let totalAdjustment = 0;

  // --- eFG% ---
  // Each team's net quality: how much better they shoot than they allow.
  // Higher off eFG% = better offense; lower def eFG% = better defense.
  const efgNetA =
    teamA.fourFactorsOffense.efgPct * weights.efgPctOffense -
    teamA.fourFactorsDefense.efgPct * weights.efgPctDefense;
  const efgNetB =
    teamB.fourFactorsOffense.efgPct * weights.efgPctOffense -
    teamB.fourFactorsDefense.efgPct * weights.efgPctDefense;
  totalAdjustment += efgNetA - efgNetB;

  // --- Turnover % ---
  // Inverted: lower offensive TO% = better (fewer turnovers committed),
  // higher defensive TO% = better (more turnovers forced).
  // Net quality = defense (positive contributor) − offense (negative contributor).
  const toNetA =
    teamA.fourFactorsDefense.toPct * weights.toPctDefense -
    teamA.fourFactorsOffense.toPct * weights.toPctOffense;
  const toNetB =
    teamB.fourFactorsDefense.toPct * weights.toPctDefense -
    teamB.fourFactorsOffense.toPct * weights.toPctOffense;
  totalAdjustment += toNetA - toNetB;

  // --- Offensive Rebound % ---
  // Each team's net rebounding quality: how much more they rebound than they allow.
  // Higher off ORB% = better; lower def ORB% (opponents' ORB) = better defense.
  const orbNetA =
    teamA.fourFactorsOffense.orbPct * weights.orbPctOffense -
    teamA.fourFactorsDefense.orbPct * weights.orbPctDefense;
  const orbNetB =
    teamB.fourFactorsOffense.orbPct * weights.orbPctOffense -
    teamB.fourFactorsDefense.orbPct * weights.orbPctDefense;
  totalAdjustment += orbNetA - orbNetB;

  // --- Free Throw Rate ---
  // Each team's net FT rate quality: how much more they get to the line than they allow.
  // Higher off FT Rate = better; lower def FT Rate = better defense.
  const ftrNetA =
    teamA.fourFactorsOffense.ftRate * weights.ftRateOffense -
    teamA.fourFactorsDefense.ftRate * weights.ftRateDefense;
  const ftrNetB =
    teamB.fourFactorsOffense.ftRate * weights.ftRateOffense -
    teamB.fourFactorsDefense.ftRate * weights.ftRateDefense;
  totalAdjustment += ftrNetA - ftrNetB;

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

/**
 * Calculates the Evan Miya opponent adjustment efficiency point adjustment.
 *
 * Compares how well each team plays up/down to competition level.
 * Positive opponent adjustment means a team "plays up" vs strong opponents
 * and performs worse against weak ones. This is particularly relevant for
 * high seeds who must play down in early rounds — a high seed with negative
 * opponent adjust is more upset-prone.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default, 2 = double)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateOpponentAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  return (
    (teamA.evanmiyaOpponentAdjust - teamB.evanmiyaOpponentAdjust) *
    OPPONENT_ADJUST_SCALING *
    weight
  );
}

/**
 * Calculates the bench depth efficiency point adjustment.
 *
 * Compares bench minutes percentages between teams. Deeper benches handle
 * foul trouble and second-half fatigue better. This lever defaults to 0
 * globally and is intended to be activated per-matchup when injury or
 * foul trouble context makes bench depth particularly relevant.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default, 2 = double)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateBenchDepthAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  return (
    (teamA.benchMinutesPct - teamB.benchMinutesPct) * BENCH_SCALING * weight
  );
}

/**
 * Calculates the Evan Miya pace adjustment efficiency point adjustment.
 *
 * Compares how well each team adapts to pace mismatches. A positive pace
 * adjustment means the team performs better in faster games. This lever
 * defaults to 0 globally and is activated per-matchup when a significant
 * pace mismatch exists between the teams.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default, 2 = double)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculatePaceAdjustAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  return (
    (teamA.evanmiyaPaceAdjust - teamB.evanmiyaPaceAdjust) *
    PACE_ADJUST_SCALING *
    weight
  );
}

/**
 * Calculates the strength of schedule efficiency point adjustment.
 *
 * Adds extra credit for teams whose efficiency was earned against tougher
 * opponents. Since adjusted ratings already partially incorporate SoS, this
 * lever is supplementary — the scaling is conservative at 0.10 eff pts per
 * 1.0 SoS point difference.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateSosAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  return (teamA.sosNetRating - teamB.sosNetRating) * SOS_SCALING * weight;
}

/**
 * Calculates the luck regression efficiency point adjustment.
 *
 * KenPom Luck measures per-game over/underperformance vs efficiency. Positive
 * luck means a team won more close games than their efficiency predicted —
 * these teams tend to regress in tournament play. This lever penalizes lucky
 * teams and rewards unlucky ones.
 *
 * Note the sign: team A's positive luck HURTS them (regression), so we negate
 * luckA's contribution: adjustment = (luckB - luckA) * scaling * weight.
 *
 * @param teamA - First team's season data
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateLuckRegressionAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number
): number {
  return (teamB.luck - teamA.luck) * LUCK_SCALING * weight;
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

// ---------------------------------------------------------------------------
// Site Proximity (mean-adjusting)
// ---------------------------------------------------------------------------

/**
 * Calculates the site proximity efficiency point adjustment for a matchup.
 *
 * Uses a continuous distance model instead of discrete buckets so that any
 * difference in campus-to-venue distance produces a non-zero adjustment.
 *
 * Each team's distance is converted to an efficiency point score via:
 *   score = MAX * e^(-decay * distance) + travel_penalty (if distance > threshold)
 *
 * The matchup adjustment is (scoreA - scoreB) * weight, so the closer team
 * gets a positive efficiency point advantage.
 *
 * If siteCoordinates is undefined (no tournament site data loaded), returns 0.
 *
 * @param teamA - First team's season data (campus coordinates from teamA.team.campus)
 * @param teamB - Second team's season data
 * @param weight - Lever weight (0 = ignore, 1 = default)
 * @param siteCoordinates - Game venue coordinates (optional; no effect if absent)
 * @returns Efficiency point adjustment (positive favors team A)
 */
export function calculateSiteProximityAdjustment(
  teamA: TeamSeason,
  teamB: TeamSeason,
  weight: number,
  siteCoordinates?: GameSiteCoordinates
): number {
  if (weight === 0 || !siteCoordinates) {
    return 0;
  }

  const distA = haversineDistance(
    teamA.team.campus.latitude,
    teamA.team.campus.longitude,
    siteCoordinates.latitude,
    siteCoordinates.longitude
  );
  const distB = haversineDistance(
    teamB.team.campus.latitude,
    teamB.team.campus.longitude,
    siteCoordinates.latitude,
    siteCoordinates.longitude
  );

  const scoreA = distanceToScore(distA);
  const scoreB = distanceToScore(distB);

  return (scoreA - scoreB) * weight;
}

/**
 * Converts a campus-to-venue distance into a continuous efficiency point score.
 *
 * Uses exponential decay: nearby teams get a large bonus, distant teams approach 0.
 * Teams traveling > 1000 miles also get a small additional penalty for fatigue.
 *
 * Examples at default constants:
 *   0 mi → +3.00,  50 mi → +2.58,  200 mi → +1.65,  500 mi → +0.67
 *   800 mi → +0.27, 1000 mi → -0.45, 1500 mi → -0.49
 */
function distanceToScore(distanceMiles: number): number {
  const proximityBonus =
    SITE_PROXIMITY_MAX * Math.exp(-SITE_PROXIMITY_DECAY * distanceMiles);

  const travelPenalty =
    distanceMiles > SITE_PROXIMITY_TRAVEL_THRESHOLD
      ? SITE_PROXIMITY_TRAVEL_PENALTY
      : 0;

  return proximityBonus + travelPenalty;
}
