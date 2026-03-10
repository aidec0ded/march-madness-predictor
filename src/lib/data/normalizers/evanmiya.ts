/**
 * Evan Miya data normalizer for the March Madness Bracket Predictor.
 *
 * Transforms raw Evan Miya CSV rows (EvanMiyaCsvRow) into partial
 * TeamSeason records. Evan Miya provides:
 *
 * - **BPR** = overall Bayesian Performance Rating (equivalent to AdjEM)
 * - **OBPR** = Offensive BPR (equivalent to AdjOE)
 * - **DBPR** = Defensive BPR (equivalent to AdjDE)
 * - **Opponent Adjustment** — plays up/down to competition
 * - **Pace Adjustment** — performance in fast vs slow games
 * - **Kill Shots** — 10-0 scoring runs (per game, allowed, margin)
 */

import type { TeamSeason, EfficiencyRatings } from "@/types";
import type { EvanMiyaCsvRow, ValidationError } from "@/types";

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
 */
function safeParseFloat(value: string | undefined): number | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parses a required numeric field. Pushes a ValidationError if parsing fails.
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
 * Normalizes an array of Evan Miya CSV rows into partial TeamSeason records.
 *
 * Each row yields efficiency ratings (in the `evanmiya` slot), the 5
 * Miya-specific metrics, and the team name. All other TeamSeason fields
 * remain unset and will be filled by KenPom/Torvik during merging.
 *
 * @param rows - Array of parsed Evan Miya CSV rows.
 * @param season - The season year to attach to each record.
 * @returns An object containing normalized data and any validation errors.
 */
export function normalizeEvanMiya(
  rows: EvanMiyaCsvRow[],
  season: number
): EvanMiyaNormalizerResult {
  const data: Partial<TeamSeason>[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: ValidationError[] = [];

    // --- Parse BPR values (required) ---
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

    // --- Parse Miya-specific metrics (optional — null if missing) ---
    const opponentAdjust = safeParseFloat(row.opponent_adjust);
    const paceAdjust = safeParseFloat(row.pace_adjust);
    const killShotsPerGame = safeParseFloat(row.runs_per_game);
    const killShotsAllowedPerGame = safeParseFloat(row.runs_conceded_per_game);
    const killShotsMargin = safeParseFloat(row.runs_margin);

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

    // Attach Miya-specific metrics
    if (opponentAdjust !== null) teamSeason.evanmiyaOpponentAdjust = opponentAdjust;
    if (paceAdjust !== null) teamSeason.evanmiyaPaceAdjust = paceAdjust;
    if (killShotsPerGame !== null) teamSeason.evanmiyaKillShotsPerGame = killShotsPerGame;
    if (killShotsAllowedPerGame !== null) teamSeason.evanmiyaKillShotsAllowedPerGame = killShotsAllowedPerGame;
    if (killShotsMargin !== null) teamSeason.evanmiyaKillShotsMargin = killShotsMargin;

    errors.push(...rowErrors);
    data.push(teamSeason);
  }

  return { data, errors };
}
