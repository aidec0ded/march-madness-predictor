/**
 * Deep validation and sanitization for engine configuration and matchup
 * overrides received from API request bodies.
 *
 * These functions clamp numeric values to safe ranges and strip unknown keys,
 * preventing callers from sending extreme values that could cause numerical
 * instability in the probability engine.
 */

import type {
  EngineConfig,
  GlobalLevers,
  CompositeWeights,
  FourFactorsLeverWeights,
  MatchupOverrides,
} from "@/types/engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number to [min, max]. Returns undefined if input is not a finite number. */
function clampNum(
  value: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, min), max);
}

/** Check if a value is a plain object (not null, not array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Lever weight ranges
// ---------------------------------------------------------------------------

/** Max multiplier for any lever weight (0 = off, 10 = 10x default) */
const MAX_LEVER_WEIGHT = 10;

/** Valid ranges for model parameters */
const LOGISTIC_K_RANGE = { min: 0.001, max: 1.0 } as const;
const BASE_VARIANCE_RANGE = { min: 1.0, max: 50.0 } as const;

/** Valid ranges for matchup override adjustments */
const INJURY_RANGE = { min: -20, max: 0 } as const;
const RECENT_FORM_RANGE = { min: -10, max: 10 } as const;
const REST_RANGE = { min: -5, max: 5 } as const;
const TWO_FOUL_RANGE = { min: 0, max: 1 } as const;

/** Maximum number of matchup overrides (67 games max in a bracket) */
const MAX_OVERRIDE_ENTRIES = 67;

/** Maximum number of picks (67 games max in a bracket) */
const MAX_PICKS_ENTRIES = 67;
/** Max length for a gameId or teamId string */
const MAX_ID_LENGTH = 50;

// ---------------------------------------------------------------------------
// Composite weights sanitizer
// ---------------------------------------------------------------------------

function sanitizeCompositeWeights(
  input: unknown
): Partial<CompositeWeights> | undefined {
  if (!isPlainObject(input)) return undefined;

  const result: Partial<CompositeWeights> = {};
  const kenpom = clampNum(input.kenpom, 0, 1);
  const torvik = clampNum(input.torvik, 0, 1);
  const evanmiya = clampNum(input.evanmiya, 0, 1);

  if (kenpom !== undefined) result.kenpom = kenpom;
  if (torvik !== undefined) result.torvik = torvik;
  if (evanmiya !== undefined) result.evanmiya = evanmiya;

  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Four Factors weights sanitizer
// ---------------------------------------------------------------------------

const FOUR_FACTORS_KEYS: (keyof FourFactorsLeverWeights)[] = [
  "efgPctOffense",
  "efgPctDefense",
  "toPctOffense",
  "toPctDefense",
  "orbPctOffense",
  "orbPctDefense",
  "ftRateOffense",
  "ftRateDefense",
];

function sanitizeFourFactorsWeights(
  input: unknown
): Partial<FourFactorsLeverWeights> | undefined {
  if (!isPlainObject(input)) return undefined;

  const result: Partial<FourFactorsLeverWeights> = {};
  for (const key of FOUR_FACTORS_KEYS) {
    const val = clampNum(input[key], 0, MAX_LEVER_WEIGHT);
    if (val !== undefined) {
      (result as Record<string, number>)[key] = val;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Global levers sanitizer
// ---------------------------------------------------------------------------

/** Known scalar lever keys and their valid range [0, MAX_LEVER_WEIGHT] */
const SCALAR_LEVER_KEYS: (keyof GlobalLevers)[] = [
  "experienceWeight",
  "continuityWeight",
  "coachExperienceWeight",
  "opponentAdjustWeight",
  "benchDepthWeight",
  "paceAdjustWeight",
  "siteProximityWeight",
  "sosWeight",
  "luckRegressionWeight",
  "tempoVarianceWeight",
  "threePtVarianceWeight",
];

function sanitizeGlobalLevers(
  input: unknown
): Partial<GlobalLevers> | undefined {
  if (!isPlainObject(input)) return undefined;

  const result: Partial<GlobalLevers> = {};

  // Composite weights
  const cw = sanitizeCompositeWeights(input.compositeWeights);
  if (cw) result.compositeWeights = cw as CompositeWeights;

  // Four Factors
  const ff = sanitizeFourFactorsWeights(input.fourFactors);
  if (ff) result.fourFactors = ff as FourFactorsLeverWeights;

  // Scalar weights
  for (const key of SCALAR_LEVER_KEYS) {
    const val = clampNum(input[key], 0, MAX_LEVER_WEIGHT);
    if (val !== undefined) {
      (result as Record<string, number>)[key] = val;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Engine config sanitizer (public API)
// ---------------------------------------------------------------------------

/**
 * Sanitizes a partial EngineConfig from an API request body.
 *
 * - Clamps all numeric lever values to safe ranges
 * - Strips unknown keys (only known GlobalLevers fields are kept)
 * - Returns undefined if input is not a valid object
 *
 * @param input - Raw value from the request body
 * @returns Sanitized partial EngineConfig, or undefined if input is invalid
 */
export function sanitizeEngineConfig(
  input: unknown
): Partial<EngineConfig> | undefined {
  if (!isPlainObject(input)) return undefined;

  const result: Partial<EngineConfig> = {};

  // Levers sub-object
  const levers = sanitizeGlobalLevers(input.levers);
  if (levers) result.levers = levers as GlobalLevers;

  // Model parameters
  const logisticK = clampNum(
    input.logisticK,
    LOGISTIC_K_RANGE.min,
    LOGISTIC_K_RANGE.max
  );
  if (logisticK !== undefined) result.logisticK = logisticK;

  const baseVariance = clampNum(
    input.baseVariance,
    BASE_VARIANCE_RANGE.min,
    BASE_VARIANCE_RANGE.max
  );
  if (baseVariance !== undefined) result.baseVariance = baseVariance;

  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Picks sanitizer (public API)
// ---------------------------------------------------------------------------

/**
 * Sanitizes a picks map from an API request body.
 *
 * - Verifies input is a plain object
 * - Caps entries to 67 (max games in a bracket)
 * - Validates each key/value is a string within length limits
 * - Strips invalid entries
 */
export function sanitizePicks(
  input: unknown
): Record<string, string> | undefined {
  if (!isPlainObject(input)) return undefined;

  const result: Record<string, string> = {};
  const keys = Object.keys(input);
  const cappedKeys = keys.slice(0, MAX_PICKS_ENTRIES);

  for (const key of cappedKeys) {
    if (typeof key !== "string" || key.length === 0 || key.length > MAX_ID_LENGTH) continue;
    const value = input[key];
    if (typeof value !== "string" || value.length === 0 || value.length > MAX_ID_LENGTH) continue;
    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ---------------------------------------------------------------------------
// Matchup overrides sanitizer (public API)
// ---------------------------------------------------------------------------

/**
 * Sanitizes a single MatchupOverrides object.
 */
function sanitizeSingleOverride(
  input: unknown
): MatchupOverrides | undefined {
  if (!isPlainObject(input)) return undefined;

  const result: MatchupOverrides = {};

  // Injury adjustments (negative only)
  const injA = clampNum(input.injuryAdjustmentA, INJURY_RANGE.min, INJURY_RANGE.max);
  if (injA !== undefined) result.injuryAdjustmentA = injA;

  const injB = clampNum(input.injuryAdjustmentB, INJURY_RANGE.min, INJURY_RANGE.max);
  if (injB !== undefined) result.injuryAdjustmentB = injB;

  // Recent form
  const formA = clampNum(input.recentFormA, RECENT_FORM_RANGE.min, RECENT_FORM_RANGE.max);
  if (formA !== undefined) result.recentFormA = formA;

  const formB = clampNum(input.recentFormB, RECENT_FORM_RANGE.min, RECENT_FORM_RANGE.max);
  if (formB !== undefined) result.recentFormB = formB;

  // Rest adjustments
  const restA = clampNum(input.restAdjustmentA, REST_RANGE.min, REST_RANGE.max);
  if (restA !== undefined) result.restAdjustmentA = restA;

  const restB = clampNum(input.restAdjustmentB, REST_RANGE.min, REST_RANGE.max);
  if (restB !== undefined) result.restAdjustmentB = restB;

  // 2-foul participation
  const tfpA = clampNum(input.twoFoulParticipationA, TWO_FOUL_RANGE.min, TWO_FOUL_RANGE.max);
  if (tfpA !== undefined) result.twoFoulParticipationA = tfpA;

  const tfpB = clampNum(input.twoFoulParticipationB, TWO_FOUL_RANGE.min, TWO_FOUL_RANGE.max);
  if (tfpB !== undefined) result.twoFoulParticipationB = tfpB;

  // Lever overrides (recursive sanitization)
  const leverOverrides = sanitizeGlobalLevers(input.leverOverrides);
  if (leverOverrides) result.leverOverrides = leverOverrides as Partial<GlobalLevers>;

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Sanitizes a matchup overrides map from an API request body.
 *
 * - Caps number of entries to 67 (max games in a bracket)
 * - Clamps all numeric fields to documented ranges
 * - Strips unknown keys
 * - Returns undefined if input is not a valid object
 *
 * @param input - Raw value from the request body
 * @returns Sanitized overrides map, or undefined if input is invalid
 */
export function sanitizeMatchupOverrides(
  input: unknown
): Record<string, MatchupOverrides> | undefined {
  if (!isPlainObject(input)) return undefined;

  const result: Record<string, MatchupOverrides> = {};
  const keys = Object.keys(input);

  // Cap entries to prevent abuse
  const cappedKeys = keys.slice(0, MAX_OVERRIDE_ENTRIES);

  for (const key of cappedKeys) {
    // Only accept string keys that look like valid game IDs
    if (typeof key !== "string" || key.length > 50) continue;

    const sanitized = sanitizeSingleOverride(input[key]);
    if (sanitized) {
      result[key] = sanitized;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
