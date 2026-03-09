/**
 * Data validation for the March Madness Bracket Predictor.
 *
 * Validates team season records against expected statistical ranges. Each
 * field has a plausible min/max derived from historical NCAA data. Validation
 * catches data entry errors, import corruption, and format mismatches before
 * bad data reaches the probability engine.
 */

import type { TeamSeason } from "@/types";
import type { ValidationError, ValidationResult } from "@/types";

// ---------------------------------------------------------------------------
// Range definitions
// ---------------------------------------------------------------------------

/**
 * Defines the acceptable range for a numeric field, including a
 * human-readable label for error messages.
 */
interface FieldRange {
  /** Minimum acceptable value (inclusive) */
  min: number;
  /** Maximum acceptable value (inclusive) */
  max: number;
  /** Human-readable field description for error messages */
  label: string;
}

/**
 * Expected ranges for all numeric fields in a TeamSeason record.
 *
 * Ranges are intentionally generous to accommodate outliers while still
 * catching clearly invalid data (e.g., a negative tempo or a 200% FG%).
 */
const FIELD_RANGES: Record<string, FieldRange> = {
  // Efficiency ratings — widened to accommodate D1 outliers (e.g., elite
  // teams with AdjEM > 40, very weak teams below -30, AdjOE above 130)
  adjOE: { min: 75, max: 140, label: "Adjusted Offensive Efficiency" },
  adjDE: { min: 75, max: 140, label: "Adjusted Defensive Efficiency" },
  adjEM: { min: -45, max: 50, label: "Adjusted Efficiency Margin" },

  // Four Factors (percentages expressed as 0-100) — widened for low-major outliers
  efgPct: { min: 25, max: 75, label: "Effective FG%" },
  toPct: { min: 5, max: 35, label: "Turnover %" },
  orbPct: { min: 10, max: 50, label: "Offensive Rebound %" },
  ftRate: { min: 10, max: 65, label: "Free Throw Rate" },

  // Shooting splits — widened for opponent 3PA rate outliers and low-major extremes
  threePtPct: { min: 15, max: 55, label: "Three-Point %" },
  threePtRate: { min: 10, max: 70, label: "Three-Point Attempt Rate" },
  ftPct: { min: 50, max: 90, label: "Free Throw %" },

  // Tempo & pace
  adjTempo: { min: 55, max: 80, label: "Adjusted Tempo" },
  avgPossLengthOff: {
    min: 12,
    max: 22,
    label: "Avg Offensive Possession Length",
  },
  avgPossLengthDef: {
    min: 12,
    max: 22,
    label: "Avg Defensive Possession Length",
  },

  // Roster & experience
  benchMinutesPct: { min: 10, max: 55, label: "Bench Minutes %" },
  experience: { min: 0, max: 4, label: "D-1 Experience (years)" },
  minutesContinuity: { min: 0, max: 100, label: "Minutes Continuity %" },
  avgHeight: { min: 70, max: 84, label: "Average Height (inches)" },

  // Coaching style
  twoFoulParticipation: { min: 0, max: 100, label: "2-Foul Participation %" },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validates a single numeric value against a field range definition.
 *
 * @param value - The value to validate.
 * @param fieldKey - Key in the FIELD_RANGES lookup.
 * @param fieldPath - Dot-separated path for the error message (e.g., "fourFactorsOffense.efgPct").
 * @param row - Row index for the error report (defaults to 0 for single-record validation).
 * @returns A ValidationError if the value is out of range or not a number, or null if valid.
 */
function validateNumericField(
  value: unknown,
  fieldKey: string,
  fieldPath: string,
  row: number
): ValidationError | null {
  const range = FIELD_RANGES[fieldKey];
  if (!range) return null;

  if (value === undefined || value === null) {
    // Missing values are not range errors -- they are caught by completeness checks
    return null;
  }

  const numValue =
    typeof value === "string" ? parseFloat(value) : (value as number);

  if (typeof numValue !== "number" || isNaN(numValue)) {
    return {
      row,
      field: fieldPath,
      message: `${range.label} must be a number, got "${String(value)}"`,
      value,
    };
  }

  if (numValue < range.min || numValue > range.max) {
    return {
      row,
      field: fieldPath,
      message: `${range.label} (${numValue}) is outside expected range [${range.min}, ${range.max}]`,
      value: numValue,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates a partial TeamSeason record against expected statistical ranges.
 *
 * Checks every present numeric field against its expected range. Fields that
 * are undefined/missing are silently skipped (they are not range errors).
 * Use the `errors` array to identify specific problems; use the `valid`
 * boolean for a quick pass/fail check.
 *
 * @param team - A partial TeamSeason record to validate. Typically produced
 *   by one of the normalizers before merging.
 * @param row - Optional row index for error reporting (useful when validating
 *   a batch of records).
 * @returns A {@link ValidationResult} summarizing pass/fail and listing
 *   every out-of-range or invalid field.
 *
 * @example
 * ```ts
 * const result = validateTeamSeason({ adjTempo: 999 });
 * // result.valid === false
 * // result.errors[0].field === "adjTempo"
 * ```
 */
export function validateTeamSeason(
  team: Partial<TeamSeason>,
  row: number = 0
): ValidationResult {
  const errors: ValidationError[] = [];

  // --- Efficiency ratings ---
  if (team.ratings) {
    for (const sourceKey of ["kenpom", "torvik", "evanmiya"] as const) {
      const rating = team.ratings[sourceKey];
      if (!rating) continue;

      const prefix = `ratings.${sourceKey}`;
      const adjOEError = validateNumericField(
        rating.adjOE,
        "adjOE",
        `${prefix}.adjOE`,
        row
      );
      if (adjOEError) errors.push(adjOEError);

      const adjDEError = validateNumericField(
        rating.adjDE,
        "adjDE",
        `${prefix}.adjDE`,
        row
      );
      if (adjDEError) errors.push(adjDEError);

      const adjEMError = validateNumericField(
        rating.adjEM,
        "adjEM",
        `${prefix}.adjEM`,
        row
      );
      if (adjEMError) errors.push(adjEMError);
    }
  }

  // --- Four Factors (offense) ---
  if (team.fourFactorsOffense) {
    const ff = team.fourFactorsOffense;
    const prefix = "fourFactorsOffense";
    const fields: [keyof typeof ff, string][] = [
      ["efgPct", "efgPct"],
      ["toPct", "toPct"],
      ["orbPct", "orbPct"],
      ["ftRate", "ftRate"],
    ];
    for (const [key, rangeKey] of fields) {
      const err = validateNumericField(
        ff[key],
        rangeKey,
        `${prefix}.${key}`,
        row
      );
      if (err) errors.push(err);
    }
  }

  // --- Four Factors (defense) ---
  if (team.fourFactorsDefense) {
    const ff = team.fourFactorsDefense;
    const prefix = "fourFactorsDefense";
    const fields: [keyof typeof ff, string][] = [
      ["efgPct", "efgPct"],
      ["toPct", "toPct"],
      ["orbPct", "orbPct"],
      ["ftRate", "ftRate"],
    ];
    for (const [key, rangeKey] of fields) {
      const err = validateNumericField(
        ff[key],
        rangeKey,
        `${prefix}.${key}`,
        row
      );
      if (err) errors.push(err);
    }
  }

  // --- Shooting splits (offense) ---
  if (team.shootingOffense) {
    const s = team.shootingOffense;
    const prefix = "shootingOffense";
    const fields: [keyof typeof s, string][] = [
      ["threePtPct", "threePtPct"],
      ["threePtRate", "threePtRate"],
      ["ftPct", "ftPct"],
    ];
    for (const [key, rangeKey] of fields) {
      const err = validateNumericField(
        s[key],
        rangeKey,
        `${prefix}.${key}`,
        row
      );
      if (err) errors.push(err);
    }
  }

  // --- Shooting splits (defense) ---
  if (team.shootingDefense) {
    const s = team.shootingDefense;
    const prefix = "shootingDefense";
    const fields: [keyof typeof s, string][] = [
      ["threePtPct", "threePtPct"],
      ["threePtRate", "threePtRate"],
      ["ftPct", "ftPct"],
    ];
    for (const [key, rangeKey] of fields) {
      const err = validateNumericField(
        s[key],
        rangeKey,
        `${prefix}.${key}`,
        row
      );
      if (err) errors.push(err);
    }
  }

  // --- Tempo & Pace ---
  const tempoError = validateNumericField(
    team.adjTempo,
    "adjTempo",
    "adjTempo",
    row
  );
  if (tempoError) errors.push(tempoError);

  const possOffError = validateNumericField(
    team.avgPossLengthOff,
    "avgPossLengthOff",
    "avgPossLengthOff",
    row
  );
  if (possOffError) errors.push(possOffError);

  const possDefError = validateNumericField(
    team.avgPossLengthDef,
    "avgPossLengthDef",
    "avgPossLengthDef",
    row
  );
  if (possDefError) errors.push(possDefError);

  // --- Roster & Experience ---
  const benchError = validateNumericField(
    team.benchMinutesPct,
    "benchMinutesPct",
    "benchMinutesPct",
    row
  );
  if (benchError) errors.push(benchError);

  const expError = validateNumericField(
    team.experience,
    "experience",
    "experience",
    row
  );
  if (expError) errors.push(expError);

  const contError = validateNumericField(
    team.minutesContinuity,
    "minutesContinuity",
    "minutesContinuity",
    row
  );
  if (contError) errors.push(contError);

  const heightError = validateNumericField(
    team.avgHeight,
    "avgHeight",
    "avgHeight",
    row
  );
  if (heightError) errors.push(heightError);

  // --- Coaching style ---
  const twoFoulError = validateNumericField(
    team.twoFoulParticipation,
    "twoFoulParticipation",
    "twoFoulParticipation",
    row
  );
  if (twoFoulError) errors.push(twoFoulError);

  return {
    valid: errors.length === 0,
    errors,
    validRowCount: errors.length === 0 ? 1 : 0,
    totalRowCount: 1,
  };
}

/**
 * Validates a batch of partial TeamSeason records.
 *
 * Convenience wrapper that calls {@link validateTeamSeason} on each record
 * and aggregates the results into a single {@link ValidationResult}.
 *
 * @param teams - Array of partial TeamSeason records to validate.
 * @returns Aggregated validation result across all records.
 */
export function validateBatch(teams: Partial<TeamSeason>[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  let validCount = 0;

  for (let i = 0; i < teams.length; i++) {
    const result = validateTeamSeason(teams[i], i);
    allErrors.push(...result.errors);
    if (result.valid) {
      validCount++;
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    validRowCount: validCount,
    totalRowCount: teams.length,
  };
}
