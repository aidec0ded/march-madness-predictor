/**
 * Torvik (barttorvik.com) data normalizer for the March Madness Bracket Predictor.
 *
 * Transforms raw Torvik API response rows (TorvikRawRow) into partial
 * TeamSeason records conforming to the unified schema. Torvik provides
 * efficiency ratings and Four Factors with a slightly different naming
 * convention and numeric (not string) field values.
 *
 * Torvik data overlaps substantially with KenPom (Four Factors, shooting).
 * When both sources are available, the merger gives KenPom priority for
 * overlapping fields. Torvik's unique contribution is its own efficiency
 * rating (adj_o, adj_d) and the Barthag win probability metric.
 */

import type {
  TeamSeason,
  EfficiencyRatings,
  FourFactors,
  ShootingSplits,
} from "@/types";
import type { TorvikRawRow, ValidationError } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Return type for the Torvik normalizer. */
export interface TorvikNormalizerResult {
  /** Successfully normalized partial TeamSeason records. */
  data: Partial<TeamSeason>[];
  /** Validation errors encountered during normalization. */
  errors: ValidationError[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a value is a finite number. Torvik data arrives as
 * numbers (not strings), but we still guard against NaN / undefined.
 *
 * @param value - The value to check.
 * @returns true if the value is a finite number.
 */
function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}

/**
 * Validates a required numeric field from a Torvik row. Pushes a
 * ValidationError if the value is not a valid number.
 *
 * @param value - The value from the Torvik row.
 * @param fieldName - Field name for error reporting.
 * @param rowIndex - Row index for error reporting.
 * @param errors - Accumulator for validation errors.
 * @returns The number if valid, or null on failure.
 */
function requireNumber(
  value: unknown,
  fieldName: string,
  rowIndex: number,
  errors: ValidationError[]
): number | null {
  if (!isValidNumber(value)) {
    errors.push({
      row: rowIndex,
      field: fieldName,
      message: `Failed to parse "${fieldName}" as a valid number`,
      value,
    });
    return null;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of raw Torvik rows into partial TeamSeason records.
 *
 * Torvik fields use snake_case naming (e.g., `adj_o`, `efg_o`). These
 * are mapped to the unified camelCase schema. Torvik's numeric values
 * arrive as JavaScript numbers rather than strings, so parsing is
 * simpler than KenPom but still validated.
 *
 * @param rows - Array of raw Torvik rows.
 * @param season - The season year to attach to each record.
 * @returns An object containing normalized data and any validation errors.
 *
 * @example
 * ```ts
 * const { data, errors } = normalizeTorvik(torvikRows, 2025);
 * ```
 */
export function normalizeTorvik(
  rows: TorvikRawRow[],
  season: number
): TorvikNormalizerResult {
  const data: Partial<TeamSeason>[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: ValidationError[] = [];

    // --- Efficiency ratings ---
    const adjOE = requireNumber(row.adj_o, "adj_o", i, rowErrors);
    const adjDE = requireNumber(row.adj_d, "adj_d", i, rowErrors);

    let ratings: { torvik?: EfficiencyRatings } | undefined;
    if (adjOE !== null && adjDE !== null) {
      ratings = {
        torvik: {
          source: "torvik",
          adjOE,
          adjDE,
          adjEM: adjOE - adjDE,
        },
      };
    }

    // --- Four Factors (offense) ---
    const efgO = requireNumber(row.efg_o, "efg_o", i, rowErrors);
    const toO = requireNumber(row.to_o, "to_o", i, rowErrors);
    const orbO = requireNumber(row.orb_o, "orb_o", i, rowErrors);
    const ftrO = requireNumber(row.ftr_o, "ftr_o", i, rowErrors);

    let fourFactorsOffense: FourFactors | undefined;
    if (efgO !== null && toO !== null && orbO !== null && ftrO !== null) {
      fourFactorsOffense = {
        efgPct: efgO,
        toPct: toO,
        orbPct: orbO,
        ftRate: ftrO,
      };
    }

    // --- Four Factors (defense) ---
    const efgD = requireNumber(row.efg_d, "efg_d", i, rowErrors);
    const toD = requireNumber(row.to_d, "to_d", i, rowErrors);
    const orbD = requireNumber(row.orb_d, "orb_d", i, rowErrors);
    const ftrD = requireNumber(row.ftr_d, "ftr_d", i, rowErrors);

    let fourFactorsDefense: FourFactors | undefined;
    if (efgD !== null && toD !== null && orbD !== null && ftrD !== null) {
      fourFactorsDefense = {
        efgPct: efgD,
        toPct: toD,
        orbPct: orbD,
        ftRate: ftrD,
      };
    }

    // --- Shooting splits (offense) ---
    const threePO = isValidNumber(row["3p_o"]) ? row["3p_o"] : null;
    const threePrO = isValidNumber(row["3pr_o"]) ? row["3pr_o"] : null;
    const ftO = isValidNumber(row.ft_o) ? row.ft_o : null;

    let shootingOffense: ShootingSplits | undefined;
    if (threePO !== null && threePrO !== null && ftO !== null) {
      shootingOffense = {
        threePtPct: threePO,
        threePtRate: threePrO,
        ftPct: ftO,
      };
    }

    // --- Shooting splits (defense) ---
    const threePD = isValidNumber(row["3p_d"]) ? row["3p_d"] : null;
    const threePrD = isValidNumber(row["3pr_d"]) ? row["3pr_d"] : null;
    const ftD = isValidNumber(row.ft_d) ? row.ft_d : null;

    let shootingDefense: ShootingSplits | undefined;
    if (threePD !== null && threePrD !== null && ftD !== null) {
      shootingDefense = {
        threePtPct: threePD,
        threePtRate: threePrD,
        ftPct: ftD,
      };
    }

    // --- Tempo ---
    const adjTempo = requireNumber(row.adj_t, "adj_t", i, rowErrors);

    // --- Build partial TeamSeason ---
    const teamSeason: Partial<TeamSeason> = {
      season,
      dataSources: ["torvik"],
    };

    // Store team name for later resolution
    if (row.team) {
      const teamName =
        typeof row.team === "string" ? row.team.trim() : String(row.team);
      teamSeason.team = {
        id: "",
        name: teamName,
        shortName: teamName,
        conference: row.conf ? String(row.conf).trim() : "",
        campus: { city: "", state: "", latitude: 0, longitude: 0 },
      };
    }

    if (ratings) teamSeason.ratings = ratings;
    if (fourFactorsOffense) teamSeason.fourFactorsOffense = fourFactorsOffense;
    if (fourFactorsDefense) teamSeason.fourFactorsDefense = fourFactorsDefense;
    if (shootingOffense) teamSeason.shootingOffense = shootingOffense;
    if (shootingDefense) teamSeason.shootingDefense = shootingDefense;
    if (adjTempo !== null) teamSeason.adjTempo = adjTempo;

    errors.push(...rowErrors);
    data.push(teamSeason);
  }

  return { data, errors };
}
