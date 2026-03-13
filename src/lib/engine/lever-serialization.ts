/**
 * Serialization helpers for GlobalLevers.
 *
 * When lever state is stored in Supabase as JSONB and read back, it arrives
 * as a plain object with no type guarantees. These functions safely convert
 * between the typed `GlobalLevers` interface and the untyped JSONB shape,
 * falling back to defaults for any missing or invalid fields.
 *
 * This ensures forward/backward compatibility: if new levers are added in
 * the future, old saved brackets get the new defaults; if a field is corrupted,
 * it silently falls back rather than crashing.
 */

import type {
  GlobalLevers,
  CompositeWeights,
  FourFactorsLeverWeights,
} from "@/types/engine";
import {
  DEFAULT_GLOBAL_LEVERS,
  DEFAULT_COMPOSITE_WEIGHTS,
  DEFAULT_FOUR_FACTORS_WEIGHTS,
} from "@/types/engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

// ---------------------------------------------------------------------------
// Deserialization
// ---------------------------------------------------------------------------

/**
 * Deserialize a plain object (e.g., from Supabase JSONB) into a typed
 * GlobalLevers, using defaults for any missing or invalid fields.
 *
 * This is safe to call with:
 * - `{}` — returns full defaults
 * - A partial object — merges with defaults
 * - `null` or non-object — returns full defaults
 */
export function deserializeGlobalLevers(
  raw: Record<string, unknown>
): GlobalLevers {
  if (!isPlainObject(raw)) {
    return { ...DEFAULT_GLOBAL_LEVERS };
  }

  // Composite weights
  const rawCW = raw.compositeWeights;
  const compositeWeights: CompositeWeights = isPlainObject(rawCW)
    ? {
        kenpom: safeNumber(rawCW.kenpom, DEFAULT_COMPOSITE_WEIGHTS.kenpom),
        torvik: safeNumber(rawCW.torvik, DEFAULT_COMPOSITE_WEIGHTS.torvik),
        evanmiya: safeNumber(rawCW.evanmiya, DEFAULT_COMPOSITE_WEIGHTS.evanmiya),
      }
    : { ...DEFAULT_COMPOSITE_WEIGHTS };

  // Four Factors weights
  const rawFF = raw.fourFactors;
  const fourFactors: FourFactorsLeverWeights = isPlainObject(rawFF)
    ? {
        efgPctOffense: safeNumber(rawFF.efgPctOffense, DEFAULT_FOUR_FACTORS_WEIGHTS.efgPctOffense),
        efgPctDefense: safeNumber(rawFF.efgPctDefense, DEFAULT_FOUR_FACTORS_WEIGHTS.efgPctDefense),
        toPctOffense: safeNumber(rawFF.toPctOffense, DEFAULT_FOUR_FACTORS_WEIGHTS.toPctOffense),
        toPctDefense: safeNumber(rawFF.toPctDefense, DEFAULT_FOUR_FACTORS_WEIGHTS.toPctDefense),
        orbPctOffense: safeNumber(rawFF.orbPctOffense, DEFAULT_FOUR_FACTORS_WEIGHTS.orbPctOffense),
        orbPctDefense: safeNumber(rawFF.orbPctDefense, DEFAULT_FOUR_FACTORS_WEIGHTS.orbPctDefense),
        ftRateOffense: safeNumber(rawFF.ftRateOffense, DEFAULT_FOUR_FACTORS_WEIGHTS.ftRateOffense),
        ftRateDefense: safeNumber(rawFF.ftRateDefense, DEFAULT_FOUR_FACTORS_WEIGHTS.ftRateDefense),
      }
    : { ...DEFAULT_FOUR_FACTORS_WEIGHTS };

  // Scalar levers
  return {
    compositeWeights,
    fourFactors,
    experienceWeight: safeNumber(raw.experienceWeight, DEFAULT_GLOBAL_LEVERS.experienceWeight),
    continuityWeight: safeNumber(raw.continuityWeight, DEFAULT_GLOBAL_LEVERS.continuityWeight),
    coachExperienceWeight: safeNumber(raw.coachExperienceWeight, DEFAULT_GLOBAL_LEVERS.coachExperienceWeight),
    opponentAdjustWeight: safeNumber(raw.opponentAdjustWeight, DEFAULT_GLOBAL_LEVERS.opponentAdjustWeight),
    benchDepthWeight: safeNumber(raw.benchDepthWeight, DEFAULT_GLOBAL_LEVERS.benchDepthWeight),
    paceAdjustWeight: safeNumber(raw.paceAdjustWeight, DEFAULT_GLOBAL_LEVERS.paceAdjustWeight),
    siteProximityWeight: safeNumber(raw.siteProximityWeight, DEFAULT_GLOBAL_LEVERS.siteProximityWeight),
    sosWeight: safeNumber(raw.sosWeight, DEFAULT_GLOBAL_LEVERS.sosWeight),
    luckRegressionWeight: safeNumber(raw.luckRegressionWeight, DEFAULT_GLOBAL_LEVERS.luckRegressionWeight),
    tempoVarianceWeight: safeNumber(raw.tempoVarianceWeight, DEFAULT_GLOBAL_LEVERS.tempoVarianceWeight),
    threePtVarianceWeight: safeNumber(raw.threePtVarianceWeight, DEFAULT_GLOBAL_LEVERS.threePtVarianceWeight),
  };
}
