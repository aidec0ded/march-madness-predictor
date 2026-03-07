/**
 * KenPom data normalizer for the March Madness Bracket Predictor.
 *
 * Transforms raw KenPom CSV rows (KenPomRawRow) into partial TeamSeason
 * records conforming to the unified schema. KenPom is the richest single
 * source, providing efficiency ratings, Four Factors, shooting splits,
 * tempo, and roster metrics.
 *
 * All string values from the CSV are parsed to numbers with validation.
 * Any field that fails to parse produces a ValidationError rather than
 * silently inserting NaN into the data.
 */

import type {
  TeamSeason,
  EfficiencyRatings,
  FourFactors,
  ShootingSplits,
} from "@/types";
import type { KenPomRawRow, ValidationError } from "@/types";

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
 * Safely parses a string value to a number. Returns null if the value is
 * empty, undefined, or not a valid number.
 *
 * @param value - The raw string value from the CSV.
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
 * Attempts to parse a required numeric field. If parsing fails, pushes
 * a ValidationError and returns null.
 *
 * @param value - Raw string from the CSV.
 * @param fieldName - Field name for error reporting.
 * @param rowIndex - Row index for error reporting.
 * @param errors - Accumulator array for validation errors.
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

/**
 * Attempts to parse an optional numeric field. Returns null silently
 * if the value is empty or missing -- no error is produced.
 *
 * @param value - Raw string from the CSV.
 * @returns The parsed number, or null if not provided.
 */
function parseOptionalNumber(value: string | undefined): number | null {
  return safeParseFloat(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalizes an array of raw KenPom CSV rows into partial TeamSeason records.
 *
 * Each KenPomRawRow is mapped to the unified schema. Fields that fail to
 * parse as numbers produce ValidationErrors in the result. The team name
 * and conference are preserved as-is from the KenPom data; team name
 * resolution to canonical IDs is handled by the merger.
 *
 * @param rows - Array of raw KenPom rows (typically from parseCsv).
 * @param season - The season year to attach to each record.
 * @returns An object containing successfully normalized data and any errors.
 *
 * @example
 * ```ts
 * const raw = parseCsv<KenPomRawRow>(csvContent);
 * const { data, errors } = normalizeKenPom(raw, 2025);
 * ```
 */
export function normalizeKenPom(
  rows: KenPomRawRow[],
  season: number
): KenPomNormalizerResult {
  const data: Partial<TeamSeason>[] = [];
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: ValidationError[] = [];

    // --- Efficiency ratings ---
    const adjOE = parseRequiredNumber(row.AdjO, "AdjO", i, rowErrors);
    const adjDE = parseRequiredNumber(row.AdjD, "AdjD", i, rowErrors);
    const adjEM = parseRequiredNumber(row.AdjEM, "AdjEM", i, rowErrors);

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

    // --- Four Factors (offense) ---
    const oeFgPct = parseRequiredNumber(
      row["OE-eFG%"],
      "OE-eFG%",
      i,
      rowErrors
    );
    const oeToPct = parseRequiredNumber(row["OE-TO%"], "OE-TO%", i, rowErrors);
    const oeOrPct = parseRequiredNumber(row["OE-OR%"], "OE-OR%", i, rowErrors);
    const oeFtr = parseRequiredNumber(row["OE-FTR"], "OE-FTR", i, rowErrors);

    let fourFactorsOffense: FourFactors | undefined;
    if (
      oeFgPct !== null &&
      oeToPct !== null &&
      oeOrPct !== null &&
      oeFtr !== null
    ) {
      fourFactorsOffense = {
        efgPct: oeFgPct,
        toPct: oeToPct,
        orbPct: oeOrPct,
        ftRate: oeFtr,
      };
    }

    // --- Four Factors (defense) ---
    const deFgPct = parseRequiredNumber(
      row["DE-eFG%"],
      "DE-eFG%",
      i,
      rowErrors
    );
    const deToPct = parseRequiredNumber(row["DE-TO%"], "DE-TO%", i, rowErrors);
    const deOrPct = parseRequiredNumber(row["DE-OR%"], "DE-OR%", i, rowErrors);
    const deFtr = parseRequiredNumber(row["DE-FTR"], "DE-FTR", i, rowErrors);

    let fourFactorsDefense: FourFactors | undefined;
    if (
      deFgPct !== null &&
      deToPct !== null &&
      deOrPct !== null &&
      deFtr !== null
    ) {
      fourFactorsDefense = {
        efgPct: deFgPct,
        toPct: deToPct,
        orbPct: deOrPct,
        ftRate: deFtr,
      };
    }

    // --- Shooting splits (offense) ---
    const threePtPct = parseRequiredNumber(row["3P%"], "3P%", i, rowErrors);
    const threePtRate = parseRequiredNumber(
      row["3PA/FGA"],
      "3PA/FGA",
      i,
      rowErrors
    );
    const ftPct = parseRequiredNumber(row["FT%"], "FT%", i, rowErrors);

    let shootingOffense: ShootingSplits | undefined;
    if (threePtPct !== null && threePtRate !== null && ftPct !== null) {
      shootingOffense = {
        threePtPct,
        threePtRate,
        ftPct,
      };
    }

    // --- Shooting splits (defense) ---
    const oppThreePtPct = parseRequiredNumber(
      row["Opp3P%"],
      "Opp3P%",
      i,
      rowErrors
    );
    const oppThreePtRate = parseRequiredNumber(
      row["Opp3PA/FGA"],
      "Opp3PA/FGA",
      i,
      rowErrors
    );
    const oppFtPct = parseRequiredNumber(row["OppFT%"], "OppFT%", i, rowErrors);

    let shootingDefense: ShootingSplits | undefined;
    if (
      oppThreePtPct !== null &&
      oppThreePtRate !== null &&
      oppFtPct !== null
    ) {
      shootingDefense = {
        threePtPct: oppThreePtPct,
        threePtRate: oppThreePtRate,
        ftPct: oppFtPct,
      };
    }

    // --- Tempo & Pace ---
    const adjTempo = parseRequiredNumber(row.AdjT, "AdjT", i, rowErrors);
    const avgPossLengthOff = parseOptionalNumber(row["AvgPossOff"]);
    const avgPossLengthDef = parseOptionalNumber(row["AvgPossDef"]);

    // --- Roster & Experience ---
    const benchMinutesPct = parseOptionalNumber(row["BenchMin%"]);
    const experience = parseOptionalNumber(row.Experience);
    const minutesContinuity = parseOptionalNumber(row.Continuity);
    const avgHeight = parseOptionalNumber(row["AvgHgt"]);

    // --- Style ---
    const twoFoulParticipation = parseOptionalNumber(row["2FoulPart"]);

    // --- Build the partial TeamSeason ---
    const teamSeason: Partial<TeamSeason> = {
      season,
      dataSources: ["kenpom"],
    };

    // Store the team name in the team field for later resolution
    if (row.Team) {
      teamSeason.team = {
        id: "",
        name: row.Team.trim(),
        shortName: row.Team.trim(),
        conference: row.Conf?.trim() || "",
        campus: { city: "", state: "", latitude: 0, longitude: 0 },
      };
    }

    if (ratings) teamSeason.ratings = ratings;
    if (fourFactorsOffense) teamSeason.fourFactorsOffense = fourFactorsOffense;
    if (fourFactorsDefense) teamSeason.fourFactorsDefense = fourFactorsDefense;
    if (shootingOffense) teamSeason.shootingOffense = shootingOffense;
    if (shootingDefense) teamSeason.shootingDefense = shootingDefense;
    if (adjTempo !== null) teamSeason.adjTempo = adjTempo;
    if (avgPossLengthOff !== null)
      teamSeason.avgPossLengthOff = avgPossLengthOff;
    if (avgPossLengthDef !== null)
      teamSeason.avgPossLengthDef = avgPossLengthDef;
    if (benchMinutesPct !== null) teamSeason.benchMinutesPct = benchMinutesPct;
    if (experience !== null) teamSeason.experience = experience;
    if (minutesContinuity !== null)
      teamSeason.minutesContinuity = minutesContinuity;
    if (avgHeight !== null) teamSeason.avgHeight = avgHeight;
    if (twoFoulParticipation !== null)
      teamSeason.twoFoulParticipation = twoFoulParticipation;

    errors.push(...rowErrors);
    data.push(teamSeason);
  }

  return { data, errors };
}
