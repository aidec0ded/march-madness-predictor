/**
 * Torvik (barttorvik.com) data normalizer for the March Madness Bracket Predictor.
 *
 * Two normalization paths:
 *
 * 1. **normalizeTorvik()** — for rows fetched from the Torvik API (TorvikRawRow).
 *    Numeric field values, snake_case naming.
 *
 * 2. **normalizeTorvikCsv()** — for rows from the Teams Table CSV export
 *    (TorvikCsvRow). String field values, space-separated column names.
 *    Provides a richer dataset including height, experience, and talent.
 *
 * Both functions produce the same Partial<TeamSeason> output.
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
import type { TorvikRawRow, TorvikCsvRow, ValidationError, Conference } from "@/types";

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
    // Four Factors are optional — the fffinal CSV may be unavailable for
    // older seasons. When missing, we simply omit them rather than erroring.
    const efgO = isValidNumber(row.efg_o) ? row.efg_o : null;
    const toO = isValidNumber(row.to_o) ? row.to_o : null;
    const orbO = isValidNumber(row.orb_o) ? row.orb_o : null;
    const ftrO = isValidNumber(row.ftr_o) ? row.ftr_o : null;

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
    const efgD = isValidNumber(row.efg_d) ? row.efg_d : null;
    const toD = isValidNumber(row.to_d) ? row.to_d : null;
    const orbD = isValidNumber(row.orb_d) ? row.orb_d : null;
    const ftrD = isValidNumber(row.ftr_d) ? row.ftr_d : null;

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
    // Tempo is optional — older Torvik seasons return 0 for all teams (likely
    // due to anti-scraping protections or unavailable data). A tempo of 0 is
    // physically impossible (real values are 55-85), so we treat it as missing
    // rather than generating hundreds of validation errors. This allows the
    // efficiency ratings and Four Factors to be imported even without tempo.
    const rawTempo = isValidNumber(row.adj_t) ? row.adj_t : null;
    const adjTempo = rawTempo !== null && rawTempo > 0 ? rawTempo : null;

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
        conference: (row.conf ? String(row.conf).trim() : "") as Conference,
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

// ---------------------------------------------------------------------------
// CSV helpers
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
 * Parses a required numeric field from a CSV string. Pushes a
 * ValidationError if parsing fails.
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
// CSV normalizer
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of Torvik Teams Table CSV rows into partial
 * TeamSeason records.
 *
 * The Teams Table CSV provides a richer dataset than the API fetch,
 * including height, experience, and additional shooting splits. Column
 * names use spaces and punctuation (e.g., "ADJ OE", "EFG D.", "3P %").
 *
 * @param rows - Array of parsed Torvik Teams Table CSV rows.
 * @param season - The season year to attach to each record.
 * @returns An object containing normalized data and any validation errors.
 *
 * @example
 * ```ts
 * const parsed = parseCsv<TorvikCsvRow>(csvContent);
 * const { data, errors } = normalizeTorvikCsv(parsed, 2025);
 * ```
 */
export function normalizeTorvikCsv(
  rows: TorvikCsvRow[],
  season: number
): TorvikNormalizerResult {
  const data: Partial<TeamSeason>[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: ValidationError[] = [];

    // --- Efficiency ratings (required) ---
    const adjOE = parseRequiredNumber(row["ADJ OE"], "ADJ OE", i, rowErrors);
    const adjDE = parseRequiredNumber(row["ADJ DE"], "ADJ DE", i, rowErrors);

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
    const efgO = safeParseFloat(row["EFG"]);
    const toO = safeParseFloat(row["TOV%"]);
    const orbO = safeParseFloat(row["O REB%"]);
    const ftrO = safeParseFloat(row["FT RATE"]);

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
    const efgD = safeParseFloat(row["EFG D."]);
    const toD = safeParseFloat(row["TOV% D"]);
    const orbD = safeParseFloat(row["OP OREB%"] ?? row["OP REB%"]);
    const ftrD = safeParseFloat(row["FT RATE D"]);

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
    const threePO = safeParseFloat(row["3P %"]);
    const threePrO = safeParseFloat(row["3P RATE"]);
    const ftO = safeParseFloat(row["FT%"]);

    let shootingOffense: ShootingSplits | undefined;
    if (threePO !== null && threePrO !== null && ftO !== null) {
      shootingOffense = {
        threePtPct: threePO,
        threePtRate: threePrO,
        ftPct: ftO,
      };
    }

    // --- Shooting splits (defense) ---
    const threePD = safeParseFloat(row["3P % D."]);
    const threePrD = safeParseFloat(row["3P RATE D"]);
    const ftD = safeParseFloat(row["OP.FT%"]);

    let shootingDefense: ShootingSplits | undefined;
    if (threePD !== null && threePrD !== null && ftD !== null) {
      shootingDefense = {
        threePtPct: threePD,
        threePtRate: threePrD,
        ftPct: ftD,
      };
    }

    // --- Tempo ---
    const rawTempo = safeParseFloat(row["ADJ. T"]);
    const adjTempo = rawTempo !== null && rawTempo > 0 ? rawTempo : null;

    // --- Height & Experience (unique to Teams Table) ---
    const avgHeight = safeParseFloat(row["AVG HGT."]);
    const experience = safeParseFloat(row["EXP"]);

    // --- Build partial TeamSeason ---
    const teamSeason: Partial<TeamSeason> = {
      season,
      dataSources: ["torvik"],
    };

    // Store team name — Teams Table CSV has TEAM as first and last column;
    // use the first occurrence (it's always the team name, clean of emoji)
    if (row.TEAM) {
      const teamName = row.TEAM.trim();
      teamSeason.team = {
        id: "",
        name: teamName,
        shortName: teamName,
        // Teams Table CSV lacks a conference column. Set empty to avoid
        // overwriting KenPom-provided conference data during commit.
        conference: "" as Conference,
        campus: { city: "", state: "", latitude: 0, longitude: 0 },
      };
    }

    if (ratings) teamSeason.ratings = ratings;
    if (fourFactorsOffense) teamSeason.fourFactorsOffense = fourFactorsOffense;
    if (fourFactorsDefense) teamSeason.fourFactorsDefense = fourFactorsDefense;
    if (shootingOffense) teamSeason.shootingOffense = shootingOffense;
    if (shootingDefense) teamSeason.shootingDefense = shootingDefense;
    if (adjTempo !== null) teamSeason.adjTempo = adjTempo;
    if (avgHeight !== null) teamSeason.avgHeight = avgHeight;
    if (experience !== null) teamSeason.experience = experience;

    errors.push(...rowErrors);
    data.push(teamSeason);
  }

  return { data, errors };
}
