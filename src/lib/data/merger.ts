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
 * Resolves a team name from a specific source to a canonical key using
 * the name mapping table. If no mapping is found, the original name
 * (lowercased and trimmed) is returned as the key.
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

  // Fallback: use the normalized name as the key
  return normalized;
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
