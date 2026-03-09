/**
 * KenPom data normalizer for the March Madness Bracket Predictor.
 *
 * Transforms pre-merged KenPom rows (KenPomMergedRow) into partial TeamSeason
 * records conforming to the unified schema. KenPom is the richest single
 * source, providing efficiency ratings, Four Factors, shooting splits,
 * tempo, and roster metrics.
 *
 * The input is already numeric (pre-parsed by the CSV merger), so this
 * normalizer focuses on structural mapping and validation of required fields.
 */

import type {
  TeamSeason,
  EfficiencyRatings,
  FourFactors,
  ShootingSplits,
} from "@/types";
import type { KenPomMergedRow, ValidationError } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Return type for the KenPom normalizer. */
export interface KenPomNormalizerResult {
  /** Successfully normalized partial TeamSeason records. */
  data: Partial<TeamSeason>[];
  /** Validation errors encountered during normalization. */
  errors: ValidationError[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Checks that a required numeric field is non-null. If null, pushes a
 * ValidationError and returns null.
 */
function requireNumber(
  value: number | null,
  fieldName: string,
  rowIndex: number,
  errors: ValidationError[]
): number | null {
  if (value === null) {
    errors.push({
      row: rowIndex,
      field: fieldName,
      message: `Required field "${fieldName}" is missing or could not be parsed`,
      value: null,
    });
    return null;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of pre-merged KenPom rows into partial TeamSeason records.
 *
 * Each KenPomMergedRow is mapped to the unified schema. Required fields
 * that are null produce ValidationErrors. Optional fields that are null
 * are silently omitted from the output.
 *
 * @param rows - Array of merged KenPom rows (from mergeKenPomCsvs).
 * @param season - The season year to attach to each record.
 * @returns An object containing successfully normalized data and any errors.
 *
 * @example
 * ```ts
 * const { data: merged } = mergeKenPomCsvs(bundle);
 * const { data, errors } = normalizeKenPom(merged, 2025);
 * ```
 */
export function normalizeKenPom(
  rows: KenPomMergedRow[],
  season: number
): KenPomNormalizerResult {
  const data: Partial<TeamSeason>[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: ValidationError[] = [];

    // --- Efficiency ratings (required) ---
    const adjOE = requireNumber(row.adjOE, "adjOE", i, rowErrors);
    const adjDE = requireNumber(row.adjDE, "adjDE", i, rowErrors);
    const adjEM = requireNumber(row.adjEM, "adjEM", i, rowErrors);

    let ratings: { kenpom?: EfficiencyRatings } | undefined;
    if (adjOE !== null && adjDE !== null && adjEM !== null) {
      ratings = {
        kenpom: {
          source: "kenpom",
          adjOE,
          adjDE,
          adjEM,
        },
      };
    }

    // --- Four Factors (offense) — optional as a group ---
    let fourFactorsOffense: FourFactors | undefined;
    if (
      row.offEfgPct !== null &&
      row.offToPct !== null &&
      row.offOrbPct !== null &&
      row.offFtRate !== null
    ) {
      fourFactorsOffense = {
        efgPct: row.offEfgPct,
        toPct: row.offToPct,
        orbPct: row.offOrbPct,
        ftRate: row.offFtRate,
      };
    }

    // --- Four Factors (defense) — optional as a group ---
    let fourFactorsDefense: FourFactors | undefined;
    if (
      row.defEfgPct !== null &&
      row.defToPct !== null &&
      row.defOrbPct !== null &&
      row.defFtRate !== null
    ) {
      fourFactorsDefense = {
        efgPct: row.defEfgPct,
        toPct: row.defToPct,
        orbPct: row.defOrbPct,
        ftRate: row.defFtRate,
      };
    }

    // --- Shooting splits (offense) — optional as a group ---
    let shootingOffense: ShootingSplits | undefined;
    if (
      row.offThreePtPct !== null &&
      row.offThreePtRate !== null &&
      row.offFtPct !== null
    ) {
      shootingOffense = {
        threePtPct: row.offThreePtPct,
        threePtRate: row.offThreePtRate,
        ftPct: row.offFtPct,
      };
    }

    // --- Shooting splits (defense) — optional as a group ---
    let shootingDefense: ShootingSplits | undefined;
    if (
      row.defThreePtPct !== null &&
      row.defThreePtRate !== null &&
      row.defFtPct !== null
    ) {
      shootingDefense = {
        threePtPct: row.defThreePtPct,
        threePtRate: row.defThreePtRate,
        ftPct: row.defFtPct,
      };
    }

    // --- Build the partial TeamSeason ---
    const teamSeason: Partial<TeamSeason> = {
      season,
      dataSources: ["kenpom"],
    };

    // Store the team name in the team field for later resolution
    if (row.teamName) {
      teamSeason.team = {
        id: "",
        name: row.teamName,
        shortName: row.teamName,
        conference: "",
        campus: { city: "", state: "", latitude: 0, longitude: 0 },
      };
    }

    if (ratings) teamSeason.ratings = ratings;
    if (fourFactorsOffense) teamSeason.fourFactorsOffense = fourFactorsOffense;
    if (fourFactorsDefense) teamSeason.fourFactorsDefense = fourFactorsDefense;
    if (shootingOffense) teamSeason.shootingOffense = shootingOffense;
    if (shootingDefense) teamSeason.shootingDefense = shootingDefense;
    if (row.adjTempo !== null) teamSeason.adjTempo = row.adjTempo;
    if (row.benchMinutesPct !== null)
      teamSeason.benchMinutesPct = row.benchMinutesPct;
    if (row.experience !== null) teamSeason.experience = row.experience;
    if (row.minutesContinuity !== null)
      teamSeason.minutesContinuity = row.minutesContinuity;
    if (row.avgHeight !== null) teamSeason.avgHeight = row.avgHeight;
    if (row.twoFoulParticipation !== null)
      teamSeason.twoFoulParticipation = row.twoFoulParticipation;

    errors.push(...rowErrors);
    data.push(teamSeason);
  }

  return { data, errors };
}
