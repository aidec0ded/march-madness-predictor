/**
 * Types for the probability engine: lever configurations, matchup inputs/outputs,
 * and overall engine settings.
 *
 * The engine takes two TeamSeason records + lever config and produces
 * a win probability with full diagnostic output.
 */

import type { SiteProximityBucket, DataSource, TournamentRound } from "./team";

// ---------------------------------------------------------------------------
// Composite Rating Config
// ---------------------------------------------------------------------------

/**
 * Weights for blending efficiency ratings from multiple sources.
 * Values should sum to 1.0 (auto-normalized if they don't).
 */
export interface CompositeWeights {
  kenpom: number;
  torvik: number;
  evanmiya: number;
}

/** Default composite weights */
export const DEFAULT_COMPOSITE_WEIGHTS: CompositeWeights = {
  kenpom: 0.4,
  torvik: 0.35,
  evanmiya: 0.25,
};

// ---------------------------------------------------------------------------
// Global Lever Configuration
// ---------------------------------------------------------------------------

/**
 * Four Factors lever weights — how much each factor shifts the mean probability.
 * Each weight is a multiplier: 0 = ignore, 1 = default weight, 2 = double weight.
 * Offense and defense are weighted separately.
 */
export interface FourFactorsLeverWeights {
  efgPctOffense: number;
  efgPctDefense: number;
  toPctOffense: number;
  toPctDefense: number;
  orbPctOffense: number;
  orbPctDefense: number;
  ftRateOffense: number;
  ftRateDefense: number;
}

/**
 * Global levers applied uniformly across all matchups.
 * These are set from the main bracket view.
 */
export interface GlobalLevers {
  // --- Mean-adjusting levers ---

  /** Composite source weights */
  compositeWeights: CompositeWeights;

  /** Four Factors weights (8 sub-levers) */
  fourFactors: FourFactorsLeverWeights;

  /**
   * Roster experience weight.
   * 0 = ignore experience, 1 = default, higher = more influence.
   */
  experienceWeight: number;

  /**
   * Minutes continuity weight.
   * Higher continuity → stability advantage.
   */
  continuityWeight: number;

  /**
   * Coach tournament experience weight.
   * 0 = ignore coaching, 1 = default, higher = more influence.
   */
  coachExperienceWeight: number;

  /**
   * Evan Miya Opponent Adjustment weight.
   * Measures how well a team plays up/down to competition level.
   * Particularly relevant for high seeds in early rounds.
   * 0 = ignore, 1 = default.
   */
  opponentAdjustWeight: number;

  /**
   * Bench depth weight.
   * Deeper benches handle foul trouble and fatigue better.
   * Default 0 (off globally, activate per-matchup for injury/foul scenarios).
   * 0 = ignore, 1 = default.
   */
  benchDepthWeight: number;

  /**
   * Evan Miya Pace Adjustment weight.
   * How well a team adapts to pace mismatches.
   * Default 0 (off globally, activate per-matchup).
   * 0 = ignore, 1 = default.
   */
  paceAdjustWeight: number;

  /**
   * Site proximity weight.
   * Controls how much campus-to-venue distance affects win probability.
   * Auto-computed from tournament site data + team campus coordinates.
   * 0 = ignore proximity, 1 = default.
   */
  siteProximityWeight: number;

  /**
   * Strength of schedule weight.
   * Extra credit for teams whose efficiency was earned against tougher opponents.
   * Adjusted ratings already partially account for SoS, so this is supplementary.
   * 0 = ignore, 1 = default.
   */
  sosWeight: number;

  /**
   * Luck regression weight.
   * Penalizes teams that overperformed their efficiency (won close games at
   * unsustainable rates). Tournament play tends to regress these outcomes.
   * 0 = ignore, 1 = default.
   */
  luckRegressionWeight: number;

  // --- Variance-adjusting levers ---

  /**
   * Pace/Tempo variance effect.
   * Controls how much tempo differences compress/expand outcome distributions.
   * 0 = no tempo effect on variance, 1 = default, higher = stronger effect.
   *
   * Mechanism: Slower pace → fewer possessions → less mean-reversion within a game
   * → tighter distribution → more upsets for underdogs.
   */
  tempoVarianceWeight: number;

  /**
   * Three-Point Rate variance effect.
   * Controls how much 3-point reliance affects distribution width.
   * 0 = no effect, 1 = default, higher = stronger.
   *
   * Mechanism: High 3PT rate → boom/bust variance → wider distribution
   * → more volatile outcomes.
   */
  threePtVarianceWeight: number;
}

// ---------------------------------------------------------------------------
// Per-Matchup Overrides
// ---------------------------------------------------------------------------

/**
 * Per-matchup adjustments that override or supplement global levers.
 * All fields are optional — omitted fields inherit global defaults.
 * Accessed from the matchup view.
 */
export interface MatchupOverrides {
  /**
   * Injury/Availability adjustment for team A.
   * Negative value (e.g., -3.0) representing estimated efficiency point loss.
   * 0 = no adjustment.
   */
  injuryAdjustmentA?: number;

  /**
   * Injury/Availability adjustment for team B.
   */
  injuryAdjustmentB?: number;

  /**
   * Recent form adjustment for team A.
   * Positive = trending up, negative = trending down.
   * Range: -5.0 to +5.0 efficiency points.
   */
  recentFormA?: number;

  /**
   * Recent form adjustment for team B.
   */
  recentFormB?: number;

  /**
   * Rest/Schedule density adjustment for team A.
   * Positive = well-rested, negative = fatigued.
   * Range: -3.0 to +3.0 efficiency points.
   */
  restAdjustmentA?: number;

  /**
   * Rest/Schedule density adjustment for team B.
   */
  restAdjustmentB?: number;

  /**
   * 2-Foul Participation for team A (manual entry, 0-1).
   * Rate at which coach keeps players with 2 fouls in the game.
   * Used for narrative context only, not probability calculation.
   */
  twoFoulParticipationA?: number;

  /**
   * 2-Foul Participation for team B (manual entry, 0-1).
   */
  twoFoulParticipationB?: number;

  /**
   * Override any global lever for this specific matchup.
   * Only the fields that differ from global are specified.
   */
  leverOverrides?: Partial<GlobalLevers>;
}

// ---------------------------------------------------------------------------
// Matchup Input / Output
// ---------------------------------------------------------------------------

/** Input to the matchup probability calculator */
export interface MatchupInput {
  /** Team A's season data */
  teamAId: string;

  /** Team B's season data */
  teamBId: string;

  /** Tournament round (affects some lever behaviors) */
  round?: TournamentRound;

  /** Per-matchup overrides (optional) */
  overrides?: MatchupOverrides;
}

/**
 * Detailed breakdown of how the probability was computed.
 * Useful for the matchup view's diagnostic display.
 */
export interface ProbabilityBreakdown {
  /** Base probability from composite rating differential (before levers) */
  baseProbability: number;

  /** Composite rating for team A */
  compositeRatingA: {
    adjOE: number;
    adjDE: number;
    adjEM: number;
    /** Which sources contributed and their weights */
    sources: { source: DataSource; weight: number; adjEM: number }[];
  };

  /** Composite rating for team B */
  compositeRatingB: {
    adjOE: number;
    adjDE: number;
    adjEM: number;
    sources: { source: DataSource; weight: number; adjEM: number }[];
  };

  /** Rating differential (A - B) used in the logistic model */
  ratingDifferential: number;

  /** Mean adjustment from Four Factors comparison */
  fourFactorsAdjustment: number;

  /** Mean adjustment from experience comparison */
  experienceAdjustment: number;

  /** Mean adjustment from continuity comparison */
  continuityAdjustment: number;

  /** Mean adjustment from coach experience comparison */
  coachAdjustment: number;

  /** Mean adjustment from Evan Miya opponent adjustment comparison */
  opponentAdjustAdjustment: number;

  /** Mean adjustment from bench depth comparison */
  benchDepthAdjustment: number;

  /** Mean adjustment from Evan Miya pace adjustment comparison */
  paceAdjustAdjustment: number;

  /** Mean adjustment from site proximity (campus-to-venue distance) */
  siteProximityAdjustment: number;

  /** Mean adjustment from strength of schedule comparison */
  sosAdjustment: number;

  /** Mean adjustment from luck regression-to-mean */
  luckRegressionAdjustment: number;

  /** Total mean adjustment from all levers */
  totalMeanAdjustment: number;

  /** Per-matchup override adjustments (injury, form, rest) */
  overrideAdjustments: {
    injury: number;
    recentForm: number;
    rest: number;
    total: number;
  };

  /** Variance multiplier from tempo effect */
  tempoVarianceMultiplier: number;

  /** Variance multiplier from three-point rate effect */
  threePtVarianceMultiplier: number;

  /** Combined variance multiplier (product of all variance effects) */
  combinedVarianceMultiplier: number;

  /** Final probability after all adjustments */
  finalProbability: number;
}

/** Full output of a matchup calculation */
export interface MatchupResult {
  /** Team A's ID */
  teamAId: string;

  /** Team B's ID */
  teamBId: string;

  /** Win probability for team A (0–1) */
  winProbabilityA: number;

  /** Win probability for team B (0–1), always = 1 - winProbabilityA */
  winProbabilityB: number;

  /** Full computation breakdown */
  breakdown: ProbabilityBreakdown;
}

// ---------------------------------------------------------------------------
// Engine Configuration
// ---------------------------------------------------------------------------

/**
 * Top-level engine configuration.
 * Combines global levers with model parameters.
 */
export interface EngineConfig {
  /** Global lever settings */
  levers: GlobalLevers;

  /**
   * Logistic model scaling factor.
   * Controls how steeply the probability curve rises with rating differential.
   * Higher k = more decisive (closer to deterministic), lower = more uncertain.
   * Default calibrated from historical tournament data.
   */
  logisticK: number;

  /**
   * Base variance (standard deviation in efficiency points) for Monte Carlo sampling.
   * This represents the inherent randomness of a single game.
   * Typical value: ~11 efficiency points (derived from historical game-to-game variance).
   */
  baseVariance: number;
}

// ---------------------------------------------------------------------------
// Default Configurations
// ---------------------------------------------------------------------------

export const DEFAULT_FOUR_FACTORS_WEIGHTS: FourFactorsLeverWeights = {
  efgPctOffense: 1.0,
  efgPctDefense: 1.0,
  toPctOffense: 1.0,
  toPctDefense: 1.0,
  orbPctOffense: 1.0,
  orbPctDefense: 1.0,
  ftRateOffense: 1.0,
  ftRateDefense: 1.0,
};

export const DEFAULT_GLOBAL_LEVERS: GlobalLevers = {
  compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS },
  fourFactors: { ...DEFAULT_FOUR_FACTORS_WEIGHTS },
  experienceWeight: 1.0,
  continuityWeight: 1.0,
  coachExperienceWeight: 1.0,
  opponentAdjustWeight: 1.0, // Active globally (high seeds playing down)
  benchDepthWeight: 0, // Matchup-level only
  paceAdjustWeight: 0, // Matchup-level only
  siteProximityWeight: 1.0, // Auto-computed from tournament sites
  sosWeight: 1.0,
  luckRegressionWeight: 1.0,
  tempoVarianceWeight: 1.0,
  threePtVarianceWeight: 1.0,
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  levers: { ...DEFAULT_GLOBAL_LEVERS },
  logisticK: 0.11,
  baseVariance: 11.0,
};

// ---------------------------------------------------------------------------
// Site Coordinates (for passing venue location into matchup resolver)
// ---------------------------------------------------------------------------

/** Coordinates of a tournament game venue, used for site proximity calculations */
export interface GameSiteCoordinates {
  latitude: number;
  longitude: number;
  /** Venue display name (for UI) */
  name?: string;
  /** City/state (for UI) */
  city?: string;
  state?: string;
}

// ---------------------------------------------------------------------------
// Site Proximity Constants
// ---------------------------------------------------------------------------

/** Efficiency point adjustments for site proximity buckets */
export const SITE_PROXIMITY_ADJUSTMENTS: Record<SiteProximityBucket, number> = {
  true_home: 3.0,
  regional_advantage: 1.5,
  neutral: 0.0,
  moderate_travel: -0.5,
  significant_travel: -1.0,
};

/** Distance thresholds (miles) for site proximity bucketing */
export const SITE_PROXIMITY_THRESHOLDS = {
  true_home: 50,
  regional_advantage: 200,
  neutral: 500,
  moderate_travel: 1000,
  // Anything beyond 1000 = significant_travel
} as const;
