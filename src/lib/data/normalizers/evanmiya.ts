/**
 * Evan Miya data normalizer for the March Madness Bracket Predictor.
 *
 * Transforms raw Evan Miya data rows (EvanMiyaRawRow) into partial
 * TeamSeason records. Evan Miya provides only Bayesian Performance
 * Ratings (BPR):
 *
 * - **BPR** = overall Bayesian Performance Rating (equivalent to AdjEM)
 * - **OBPR** = Offensive BPR (equivalent to AdjOE)
 * - **DBPR** = Defensive BPR (equivalent to AdjDE)
 *
 * Evan Miya does not provide Four Factors, shooting splits, tempo, or
 * roster metrics. Those fields are filled by KenPom and/or Torvik
 * during the merge step.
 */

import type { TeamSeason, EfficiencyRatings } from "@/types";
import type { EvanMiyaRawRow, ValidationError } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Return type for the Evan Miya normalizer. */
export interface EvanMiyaNormalizerResult {
  /** Successfully normalized partial TeamSeason records. */
  data: Partial<TeamSeason>[];
  /** Validation errors encountered during normalization. */
  errors: ValidationError[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely parses a string value to a number. Returns null if the value
 * is empty, undefined, or not a valid number.
 *
 * @param value - The raw string value.
 * @returns The parsed number, or null if parsing fails.
 */
function safeParseFloat(value: string | undefined): number | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parses a required numeric field from an Evan Miya row. Pushes a
 * ValidationError if the value cannot be parsed.
 *
 * @param value - Raw string from the data row.
 * @param fieldName - Field name for error reporting.
 * @param rowIndex - Row index for error reporting.
 * @param errors - Accumulator for validation errors.
 * @returns The parsed number, or null on failure.
 */
function parseRequiredNumber(
  value: string | undefined,
  fieldName: string,
  rowIndex: number,
  errors: ValidationError[]
): number | null {
  const parsed = safeParseFloat(value);
  if (parsed === null) {
    errors.push({
      row: rowIndex,
      field: fieldName,
      message: `Failed to parse "${fieldName}" as a number`,
      value: value ?? null,
    });
    return null;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of raw Evan Miya rows into partial TeamSeason records.
 *
 * Each row yields only efficiency ratings (in the `evanmiya` slot) and the
 * team name. All other TeamSeason fields remain unset and will be filled
 * by KenPom/Torvik data during merging.
 *
 * @param rows - Array of raw Evan Miya rows.
 * @param season - The season year to attach to each record.
 * @returns An object containing normalized data and any validation errors.
 *
 * @example
 * ```ts
 * const { data, errors } = normalizeEvanMiya(evanMiyaRows, 2025);
 * ```
 */
export function normalizeEvanMiya(
  rows: EvanMiyaRawRow[],
  season: number
): EvanMiyaNormalizerResult {
  const data: Partial<TeamSeason>[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: ValidationError[] = [];

    // --- Parse BPR values ---
    const bpr = parseRequiredNumber(row.bpr, "bpr", i, rowErrors);
    const obpr = parseRequiredNumber(row.obpr, "obpr", i, rowErrors);
    const dbpr = parseRequiredNumber(row.dbpr, "dbpr", i, rowErrors);

    let ratings: { evanmiya?: EfficiencyRatings } | undefined;
    if (bpr !== null && obpr !== null && dbpr !== null) {
      ratings = {
        evanmiya: {
          source: "evanmiya",
          adjOE: obpr,
          adjDE: dbpr,
          adjEM: bpr,
        },
      };
    }

    // --- Build partial TeamSeason ---
    const teamSeason: Partial<TeamSeason> = {
      season,
      dataSources: ["evanmiya"],
    };

    // Store team name for later resolution
    if (row.team) {
      teamSeason.team = {
        id: "",
        name: row.team.trim(),
        shortName: row.team.trim(),
        conference: "",
        campus: { city: "", state: "", latitude: 0, longitude: 0 },
      };
    }

    if (ratings) teamSeason.ratings = ratings;

    errors.push(...rowErrors);
    data.push(teamSeason);
  }

  return { data, errors };
}
