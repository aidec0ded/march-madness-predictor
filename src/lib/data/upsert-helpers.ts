/**
 * Reusable database upsert helpers for the March Madness Bracket Predictor.
 *
 * Extracts common upsert patterns (batch processing with individual fallback,
 * NaN handling, short name generation) from the data seeding pipeline into
 * composable functions that can be shared across multiple import scripts.
 *
 * @module
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { logger } from "@/lib/logger";
import { normalizeForMerge } from "@/lib/data/merger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Batch size for Supabase upsert operations. */
export const BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Converts NaN, undefined, or null to null; passes through valid numbers.
 * Useful for sanitising parsed numeric data before database insertion.
 */
export function nanToNull(value: number | undefined | null): number | null {
  if (value === undefined || value === null || isNaN(value)) return null;
  return value;
}

/**
 * Mapping of full team names to their commonly-used short/display names.
 * Used by {@link generateShortName} when the full name has a well-known
 * abbreviation.
 */
export const SHORT_NAME_OVERRIDES: Record<string, string> = {
  Connecticut: "UConn",
  "North Carolina": "UNC",
  "North Carolina St.": "NC State",
  "NC State": "NC State",
  "Southern California": "USC",
  "Brigham Young": "BYU",
  "Texas Christian": "TCU",
  "Virginia Commonwealth": "VCU",
  "College of Charleston": "Charleston",
  "Loyola Chicago": "Loyola-Chi",
  "Saint Mary's": "St. Mary's",
  "Saint Joseph's": "St. Joe's",
  "Saint Peter's": "St. Peter's",
  "Saint Louis": "SLU",
  "Saint John's": "St. John's",
  "Miami FL": "Miami",
  "Miami OH": "Miami OH",
  "George Washington": "GW",
  "George Mason": "G. Mason",
  "Florida Gulf Coast": "FGCU",
  Massachusetts: "UMass",
  "South Florida": "USF",
  "Central Florida": "UCF",
  "Middle Tennessee": "MTSU",
  "Western Kentucky": "WKU",
  "Southern Mississippi": "Southern Miss",
  "Appalachian St.": "App State",
  "Northern Illinois": "NIU",
  "Northern Iowa": "UNI",
  "Northern Kentucky": "NKU",
  "Eastern Washington": "EWU",
  "Eastern Michigan": "EMU",
  "Eastern Kentucky": "EKU",
  "Eastern Illinois": "EIU",
  "Western Michigan": "WMU",
  "Western Illinois": "WIU",
  "Western Carolina": "W. Carolina",
  "Southern Illinois": "SIU",
  "Central Michigan": "CMU",
  "Central Arkansas": "UCA",
  "Southeastern Louisiana": "SE Louisiana",
};

/**
 * Generates a short display name for a team.
 *
 * - If the name is in {@link SHORT_NAME_OVERRIDES}, returns the override.
 * - If the name is 20 characters or fewer, returns it as-is.
 * - Otherwise truncates to 20 characters.
 */
export function generateShortName(teamName: string): string {
  if (SHORT_NAME_OVERRIDES[teamName]) return SHORT_NAME_OVERRIDES[teamName];
  if (teamName.length <= 20) return teamName;
  return teamName.substring(0, 20);
}

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** Shape of a team record for upsert into the `teams` table. */
export interface TeamUpsertRecord {
  name: string;
  short_name: string;
  conference: string;
  campus_city: string;
  campus_state: string;
  campus_lat: number;
  campus_lng: number;
}

/** Shape of a team_seasons record for upsert. */
export interface TeamSeasonUpsertRecord {
  team_id: string;
  season: number;
  [key: string]: unknown; // Dynamic columns based on source
}

/** Aggregated stats from a full upsert run. */
export interface UpsertStats {
  teamsUpserted: number;
  teamSeasonsUpserted: number;
  nameMappingsUpserted: number;
  errors: number;
  errorMessages: string[];
}

/** Shape of a name-mapping record for upsert into `team_name_mappings`. */
export interface NameMappingUpsertRecord {
  team_id: string;
  kenpom_name?: string;
  torvik_name?: string;
  evanmiya_name?: string;
}

/** Shape of an import-job record for insertion into `import_jobs`. */
export interface ImportJobRecord {
  source: string;
  season: number;
  status: string;
  teams_imported: number;
  validation?: unknown;
}

// ---------------------------------------------------------------------------
// Canonical name resolution
// ---------------------------------------------------------------------------

/**
 * Resolves source-specific team names to canonical names that already exist
 * in the database. This prevents duplicate team records when different
 * sources use different naming conventions (e.g., "Utah State" in KenPom
 * vs "Utah St." in Torvik).
 *
 * For each source name, checks if `normalizeForMerge(sourceName)` matches
 * `normalizeForMerge(existingName)` for any team already in the DB. If a
 * match is found, the existing team's name is used as the canonical name.
 * If no match, the source name is used as-is.
 *
 * @param supabase - Supabase admin client.
 * @param sourceNames - Array of team names from the data source.
 * @returns A map from source name to canonical name.
 */
export async function resolveCanonicalTeamNames(
  supabase: SupabaseClient<Database>,
  sourceNames: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // Fetch all existing team names from the database
  const { data: existingTeams, error } = await supabase
    .from("teams")
    .select("name");

  if (error) {
    logger.warn("Failed to fetch existing team names for canonical resolution", {
      error: error.message,
    });
    // Fall back to identity mapping (no canonicalization)
    for (const name of sourceNames) {
      result.set(name, name);
    }
    return result;
  }

  // Build a normalized-key → existing-name map
  const normalizedToExisting = new Map<string, string>();
  if (existingTeams) {
    for (const team of existingTeams) {
      const key = normalizeForMerge(team.name);
      // If multiple existing records normalize to the same key (shouldn't
      // happen normally), the first one wins.
      if (!normalizedToExisting.has(key)) {
        normalizedToExisting.set(key, team.name);
      }
    }
  }

  // Resolve each source name
  for (const name of sourceNames) {
    const key = normalizeForMerge(name);
    const existing = normalizedToExisting.get(key);
    if (existing && existing !== name) {
      result.set(name, existing);
    } else {
      result.set(name, name);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Async upsert helpers
// ---------------------------------------------------------------------------

/**
 * Batch-upserts team records into the `teams` table with individual-row
 * fallback on batch failure. Returns a name-to-id map and partial stats.
 */
export async function upsertTeams(
  supabase: SupabaseClient<Database>,
  teams: TeamUpsertRecord[]
): Promise<{ teamIdMap: Map<string, string>; stats: Partial<UpsertStats> }> {
  const teamIdMap = new Map<string, string>();
  const stats: Partial<UpsertStats> = {
    teamsUpserted: 0,
    errors: 0,
    errorMessages: [],
  };

  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = teams.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from("teams")
      .upsert(batch, {
        onConflict: "name",
        ignoreDuplicates: false,
      })
      .select("id, name");

    if (error) {
      logger.warn("Batch upsert failed for teams, falling back to individual inserts", {
        batchIndex: i / BATCH_SIZE + 1,
        error: error.message,
      });
      stats.errors = (stats.errors ?? 0) + 1;
      stats.errorMessages?.push(`Teams batch ${i / BATCH_SIZE + 1}: ${error.message}`);

      // Individual fallback
      for (const team of batch) {
        const { data: singleData, error: singleError } = await supabase
          .from("teams")
          .upsert(team, { onConflict: "name", ignoreDuplicates: false })
          .select("id, name");

        if (singleError) {
          logger.warn(`Failed to upsert team "${team.name}"`, {
            error: singleError.message,
          });
          stats.errors = (stats.errors ?? 0) + 1;
          stats.errorMessages?.push(`Team "${team.name}": ${singleError.message}`);
        } else if (singleData && singleData.length > 0) {
          teamIdMap.set(singleData[0].name, singleData[0].id);
          stats.teamsUpserted = (stats.teamsUpserted ?? 0) + 1;
        }
      }
    } else if (data) {
      for (const row of data) {
        teamIdMap.set(row.name, row.id);
        stats.teamsUpserted = (stats.teamsUpserted ?? 0) + 1;
      }
    }
  }

  // If the upsert didn't return data (some Supabase versions), fetch all team IDs
  if (teamIdMap.size === 0) {
    logger.info("Upsert returned no data; fetching team IDs from database");
    const { data: allTeams, error: fetchError } = await supabase
      .from("teams")
      .select("id, name");

    if (fetchError) {
      logger.error("Failed to fetch team IDs", new Error(fetchError.message));
      stats.errors = (stats.errors ?? 0) + 1;
      stats.errorMessages?.push(`Fetch team IDs: ${fetchError.message}`);
    } else if (allTeams) {
      for (const team of allTeams) {
        teamIdMap.set(team.name, team.id);
      }
    }
  }

  return { teamIdMap, stats };
}

/**
 * Batch-upserts team-season records into the `team_seasons` table with
 * individual-row fallback on batch failure.
 */
export async function upsertTeamSeasons(
  supabase: SupabaseClient<Database>,
  records: TeamSeasonUpsertRecord[]
): Promise<{ count: number; errors: string[] }> {
  let count = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("team_seasons")
      .upsert(batch as any, {
        onConflict: "team_id,season",
        ignoreDuplicates: false,
      });

    if (error) {
      logger.warn("Batch upsert failed for team_seasons, falling back to individual inserts", {
        batchIndex: i / BATCH_SIZE + 1,
        error: error.message,
      });
      errors.push(`team_seasons batch ${i / BATCH_SIZE + 1}: ${error.message}`);

      // Individual fallback
      for (const record of batch) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: singleError } = await supabase
          .from("team_seasons")
          .upsert(record as any, {
            onConflict: "team_id,season",
            ignoreDuplicates: false,
          });

        if (singleError) {
          logger.warn(`Failed to upsert team_season for team_id=${record.team_id}`, {
            error: singleError.message,
          });
          errors.push(`team_id=${record.team_id}: ${singleError.message}`);
        } else {
          count++;
        }
      }
    } else {
      count += batch.length;
    }
  }

  return { count, errors };
}

/**
 * Batch-upserts name-mapping records into the `team_name_mappings` table with
 * individual-row fallback on batch failure.
 */
export async function upsertNameMappings(
  supabase: SupabaseClient<Database>,
  mappings: NameMappingUpsertRecord[]
): Promise<{ count: number; errors: string[] }> {
  let count = 0;
  const errors: string[] = [];

  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("team_name_mappings")
      .upsert(batch as any, {
        onConflict: "team_id",
        ignoreDuplicates: false,
      });

    if (error) {
      logger.warn("Batch upsert failed for team_name_mappings, falling back to individual inserts", {
        batchIndex: i / BATCH_SIZE + 1,
        error: error.message,
      });
      errors.push(`name_mappings batch ${i / BATCH_SIZE + 1}: ${error.message}`);

      // Individual fallback
      for (const mapping of batch) {
        const { error: singleError } = await supabase
          .from("team_name_mappings")
          .upsert(mapping as any, {
            onConflict: "team_id",
            ignoreDuplicates: false,
          });

        if (singleError) {
          if (singleError.message.includes("team_name_mappings_torvik_unique")) {
            logger.warn(`Skipping duplicate torvik_name mapping for team_id=${mapping.team_id}`);
          } else {
            logger.warn(`Failed to upsert name mapping for team_id=${mapping.team_id}`, {
              error: singleError.message,
            });
          }
          errors.push(`team_id=${mapping.team_id}: ${singleError.message}`);
        } else {
          count++;
        }
      }
    } else {
      count += batch.length;
    }
  }

  return { count, errors };
}

/**
 * Records an import job in the `import_jobs` table. Logs a warning on failure
 * but does not throw, since the actual data import may have succeeded.
 */
export async function recordImportJob(
  supabase: SupabaseClient<Database>,
  job: ImportJobRecord
): Promise<void> {
  try {
    const { error } = await supabase.from("import_jobs").insert({
      source: job.source as any,
      season: job.season,
      status: job.status as any,
      teams_imported: job.teams_imported,
      validation: job.validation as any,
    });

    if (error) {
      logger.warn("Failed to record import job", {
        error: error.message,
        source: job.source,
        season: job.season,
      });
    }
  } catch (err) {
    logger.warn("Failed to record import job (exception)", {
      error: err instanceof Error ? err.message : String(err),
      source: job.source,
      season: job.season,
    });
  }
}
