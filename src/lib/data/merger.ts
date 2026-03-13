/**
 * Data merger for the March Madness Bracket Predictor.
 *
 * Combines partial TeamSeason records from multiple data sources (KenPom,
 * Torvik, Evan Miya) into complete TeamSeason records. Each source
 * contributes its own efficiency ratings slot, and for overlapping
 * statistical fields (Four Factors, shooting splits), KenPom takes
 * priority.
 *
 * Teams are matched across sources by team name and season. The
 * TeamNameMapping system handles inconsistent naming conventions
 * (e.g., "Connecticut" in KenPom vs "UConn" in Torvik).
 */

import type { TeamSeason, DataSource, CoachRecord } from "@/types";
import type { TeamNameMapping } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data source contribution to the merge. */
export interface MergeSource {
  /** Which data source this batch comes from. */
  source: DataSource;
  /** Partial TeamSeason records from this source. */
  data: Partial<TeamSeason>[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the team name from a partial TeamSeason record.
 *
 * @param record - A partial TeamSeason record.
 * @returns The team name string, or undefined if not available.
 */
function getTeamName(record: Partial<TeamSeason>): string | undefined {
  return record.team?.name;
}

/**
 * Abbreviation normalization rules applied during merge key resolution.
 *
 * These handle the most common naming discrepancies between KenPom, Torvik,
 * and Evan Miya. Each rule is a [pattern, replacement] pair applied in order
 * to a lowercased team name. Rules should produce the SAME output regardless
 * of which source's naming convention the input uses.
 *
 * Examples:
 *   "Ohio State"  →  "ohio state"   (KenPom)
 *   "Ohio St."    →  "ohio state"   (Torvik — "st." becomes "state")
 *   "UConn"       →  "connecticut"  (either source)
 */
const NAME_NORMALIZATION_RULES: [RegExp, string][] = [
  // ── "Saint" / "St." / "St" prefix ──
  // MUST come before the suffix "St"/"St." → "state" rules to avoid
  // "St. Mary's" → "State Mary's" or "St Louis" → "State Louis".
  [/^st\.\s+/g, "saint "],
  [/^st\s+/g, "saint "],

  // ── "St." / "St" suffix → "state" ──
  // (e.g., "Ohio St." → "Ohio State", "Michigan St" → "Michigan State")
  // Only matches "St"/"St." preceded by a space — never at start of name.
  [/\bst\.$/g, "state"],
  [/(\s)st\.\s/g, "$1state "],
  [/(\s)st\.$/g, "$1state"],
  [/(\s)st$/g, "$1state"],
  [/(\s)st\s/g, "$1state "],

  // ── Multi-word abbreviations (with and without periods) ──
  // NC / N.C. → "north carolina" (for "NC State", "N.C. State")
  [/\bn\.c\.\s*/g, "north carolina "],
  [/\bn\.c\b/g, "north carolina"],
  [/\bnc\s+/g, "north carolina "],
  [/\bnc$/g, "north carolina"],
  // SC / S.C. → "south carolina" (for "SC Upstate", "S.C. State")
  [/\bs\.c\.\s*/g, "south carolina "],
  [/\bs\.c\b/g, "south carolina"],
  [/\bsc\s+/g, "south carolina "],
  [/\bsc$/g, "south carolina"],
  // MS → "mississippi" (for "MS Valley St")
  [/\bms\s+/g, "mississippi "],

  // ── Mount / Mt. / Mt ──
  [/\bmt\.\s*/g, "mount "],
  [/\bmt\s+/g, "mount "],

  // "Fla." → "florida"
  [/\bfla\.?\b/g, "florida"],

  // "Ill." → "illinois"
  [/\bill\.?\b/g, "illinois"],

  // ── Directional abbreviations (with and without periods) ──
  // With periods (Torvik/KenPom style: "N. Dakota St.", "S.C. State")
  [/\bn\.\s*/g, "north "],
  [/\bs\.\s*/g, "south "],
  [/\be\.\s*/g, "east "],
  [/\bw\.\s*/g, "west "],
  // Without periods (Kaggle style: "N Dakota St", "S Dakota St")
  // Only matches single-letter standalone word followed by space.
  [/\bn\s+(?=[a-z])/g, "north "],
  [/\bs\s+(?=[a-z])/g, "south "],
  [/\be\s+(?=[a-z])/g, "east "],
  [/\bw\s+(?=[a-z])/g, "west "],

  // "UConn" → "connecticut"
  [/\buconn\b/g, "connecticut"],

  // "UCF" → "central florida"
  [/\bucf\b/g, "central florida"],

  // "USF" → "south florida"
  [/\busf\b/g, "south florida"],

  // "UMass" → "massachusetts"
  [/\bumass\b/g, "massachusetts"],

  // "BYU" → "brigham young"
  [/\bbyu\b/g, "brigham young"],

  // "TCU" → "texas christian"
  [/\btcu\b/g, "texas christian"],

  // "VCU" → "virginia commonwealth"
  [/\bvcu\b/g, "virginia commonwealth"],

  // "UNC" → "north carolina"
  [/\bunc\b/g, "north carolina"],

  // "USC" → "southern california"
  [/\busc\b/g, "southern california"],

  // "FGCU" → "florida gulf coast"
  [/\bfgcu\b/g, "florida gulf coast"],

  // "SLU" → "saint louis"
  [/\bslu\b/g, "saint louis"],

  // "MTSU" → "middle tennessee"
  [/\bmtsu\b/g, "middle tennessee"],

  // "ETSU" → "east tennessee state"
  [/\betsu\b/g, "east tennessee state"],

  // "UNI" → "northern iowa"
  [/\buni\b/g, "northern iowa"],

  // Possessive variation: "Mary's" vs "Marys"
  [/'/g, ""],

  // Trailing/extra punctuation
  [/\./g, ""],

  // Collapse multiple spaces
  [/\s+/g, " "],
];

/**
 * Normalizes a team name to a canonical merge key by applying abbreviation
 * rules that handle discrepancies between data sources.
 *
 * This is a pure function: same input always yields same output.
 *
 * @param name - Raw team name from any data source.
 * @returns A normalized key suitable for grouping across sources.
 *
 * @example
 * normalizeForMerge("Ohio State")  // → "ohio state"
 * normalizeForMerge("Ohio St.")    // → "ohio state"
 * normalizeForMerge("UConn")       // → "connecticut"
 * normalizeForMerge("St. Mary's")  // → "saint marys"
 */
export function normalizeForMerge(name: string): string {
  let result = name.trim().toLowerCase();

  for (const [pattern, replacement] of NAME_NORMALIZATION_RULES) {
    // Reset lastIndex since we reuse regex objects with /g flag
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }

  return result.trim();
}

/**
 * Resolves a team name from a specific source to a canonical key using
 * the name mapping table. If no mapping is found, the name is normalized
 * using abbreviation rules to produce a consistent merge key.
 *
 * @param name - The team name as it appears in the source data.
 * @param source - Which data source the name comes from.
 * @param mappings - Array of team name mappings.
 * @returns A canonical key string for grouping across sources.
 */
function resolveCanonicalKey(
  name: string,
  source: DataSource,
  mappings: TeamNameMapping[]
): string {
  const normalized = name.trim().toLowerCase();

  for (const mapping of mappings) {
    let sourceName: string;
    switch (source) {
      case "kenpom":
        sourceName = mapping.kenpomName;
        break;
      case "torvik":
        sourceName = mapping.torvikName;
        break;
      case "evanmiya":
        sourceName = mapping.evanmiyaName;
        break;
    }

    if (sourceName.trim().toLowerCase() === normalized) {
      return mapping.teamId;
    }
  }

  // Fallback: normalize using abbreviation rules for cross-source matching
  return normalizeForMerge(name);
}

/**
 * Creates a default empty CoachRecord placeholder.
 *
 * @returns A CoachRecord with zeroed-out fields and an empty name.
 */
function defaultCoachRecord(): CoachRecord {
  return {
    name: "",
    tournamentGames: 0,
    tournamentWins: 0,
    finalFours: 0,
    championships: 0,
    yearsHeadCoach: 0,
  };
}

/**
 * Merges a single field from a source record into the target, applying
 * the priority rule: only overwrite if the target field is currently
 * undefined/null.
 *
 * @param target - The merge target (mutated in place).
 * @param source - The source record to merge from.
 * @param key - The field key to merge.
 */
function mergeField<K extends keyof TeamSeason>(
  target: Partial<TeamSeason>,
  source: Partial<TeamSeason>,
  key: K
): void {
  if (source[key] !== undefined && target[key] === undefined) {
    (target as Record<string, unknown>)[key as string] = source[key];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merges normalized data from multiple sources into complete TeamSeason records.
 *
 * The merge process:
 * 1. Groups records by (canonicalTeamKey, season).
 * 2. For each group, combines efficiency ratings by assigning each source's
 *    ratings to its own slot (kenpom, torvik, evanmiya).
 * 3. For overlapping fields (Four Factors, shooting splits, tempo, etc.),
 *    KenPom data takes priority, followed by Torvik, then Evan Miya.
 * 4. Produces complete TeamSeason records with sensible defaults for any
 *    fields that no source provided.
 *
 * @param sources - Array of source contributions, each containing a DataSource
 *   identifier and the corresponding partial TeamSeason records.
 * @param nameMappings - Optional array of TeamNameMapping entries for
 *   resolving inconsistent team names across sources. If not provided,
 *   exact name matching (case-insensitive) is used.
 * @returns Array of merged TeamSeason records.
 *
 * @example
 * ```ts
 * const merged = mergeTeamData([
 *   { source: "kenpom", data: kenpomData },
 *   { source: "torvik", data: torvikData },
 *   { source: "evanmiya", data: evanmiyaData },
 * ], nameMappings);
 * ```
 */
export function mergeTeamData(
  sources: MergeSource[],
  nameMappings: TeamNameMapping[] = []
): Partial<TeamSeason>[] {
  // Group all records by canonical key + season
  const groups = new Map<
    string,
    { records: { source: DataSource; record: Partial<TeamSeason> }[] }
  >();

  for (const { source, data } of sources) {
    for (const record of data) {
      const teamName = getTeamName(record);
      if (!teamName) continue;

      const canonicalKey = resolveCanonicalKey(teamName, source, nameMappings);
      const season = record.season ?? 0;
      const groupKey = `${canonicalKey}::${season}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { records: [] });
      }
      groups.get(groupKey)!.records.push({ source, record });
    }
  }

  // Merge each group into a single TeamSeason record
  const results: Partial<TeamSeason>[] = [];

  // Define source priority order: KenPom > Torvik > Evan Miya
  const sourcePriority: DataSource[] = ["kenpom", "torvik", "evanmiya"];

  for (const [, group] of groups) {
    const merged: Partial<TeamSeason> = {
      id: "",
      teamId: "",
      ratings: {},
      dataSources: [],
      updatedAt: new Date().toISOString(),
    };

    // Sort records by source priority so KenPom is applied first
    const sortedRecords = [...group.records].sort((a, b) => {
      return (
        sourcePriority.indexOf(a.source) - sourcePriority.indexOf(b.source)
      );
    });

    for (const { source, record } of sortedRecords) {
      // --- Always merge efficiency ratings into their own slot ---
      if (record.ratings) {
        if (!merged.ratings) merged.ratings = {};

        if (source === "kenpom" && record.ratings.kenpom) {
          merged.ratings.kenpom = record.ratings.kenpom;
        }
        if (source === "torvik" && record.ratings.torvik) {
          merged.ratings.torvik = record.ratings.torvik;
        }
        if (source === "evanmiya" && record.ratings.evanmiya) {
          merged.ratings.evanmiya = record.ratings.evanmiya;
        }
      }

      // --- Track which sources contributed ---
      if (!merged.dataSources) merged.dataSources = [];
      if (!merged.dataSources.includes(source)) {
        merged.dataSources.push(source);
      }

      // --- Merge team identity (first source with data wins) ---
      mergeField(merged, record, "team");
      mergeField(merged, record, "season");

      // --- Overlapping statistical fields: first source (by priority) wins ---
      mergeField(merged, record, "fourFactorsOffense");
      mergeField(merged, record, "fourFactorsDefense");
      mergeField(merged, record, "shootingOffense");
      mergeField(merged, record, "shootingDefense");
      mergeField(merged, record, "adjTempo");
      mergeField(merged, record, "avgPossLengthOff");
      mergeField(merged, record, "avgPossLengthDef");
      mergeField(merged, record, "benchMinutesPct");
      mergeField(merged, record, "experience");
      mergeField(merged, record, "minutesContinuity");
      mergeField(merged, record, "avgHeight");
      mergeField(merged, record, "twoFoulParticipation");
    }

    // --- Apply defaults for fields that no source provided ---
    if (!merged.coach) {
      merged.coach = defaultCoachRecord();
    }

    results.push(merged);
  }

  return results;
}
