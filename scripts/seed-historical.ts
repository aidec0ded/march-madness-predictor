/**
 * Historical Torvik data seeder for the March Madness Bracket Predictor.
 *
 * Bulk-fetches Torvik data for multiple historical seasons and seeds them
 * into Supabase. This adapts the single-season pattern from fetch-and-seed.ts
 * to support seeding multiple years in a single run with sequential processing
 * and rate-limiting between seasons.
 *
 * Usage:
 *   npx tsx scripts/seed-historical.ts [season1] [season2] ...
 *
 * Examples:
 *   npx tsx scripts/seed-historical.ts 2021 2022 2023 2024
 *   npx tsx scripts/seed-historical.ts                       # defaults to 2021-2024
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Service role key (bypasses RLS)
 *
 * @module
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Relative imports (path aliases don't work in standalone tsx scripts)
// ---------------------------------------------------------------------------

import { fetchTorvikData } from "../src/lib/data/fetchers/torvik";
import { normalizeTorvik } from "../src/lib/data/normalizers/torvik";
import {
  getCampusLocation,
  type CampusLocation,
} from "../src/lib/data/campus-locations";
import type { TeamSeason } from "../src/types/team";
import type { Database } from "../src/lib/supabase/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_SEASONS = [2021, 2022, 2023, 2024];

/** Batch size for Supabase upsert operations */
const BATCH_SIZE = 50;

/** Crawl delay between Torvik requests within a season (ms) */
const CRAWL_DELAY_MS = 10_000;

/** Delay between seasons to avoid rate limiting (ms) */
const INTER_SEASON_DELAY_MS = 10_000;

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error(
      "Make sure you have a .env or .env.local file with the following variables:"
    );
    console.error("  NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>");
    console.error("  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>");
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Short name generation
// ---------------------------------------------------------------------------

const SHORT_NAME_OVERRIDES: Record<string, string> = {
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
  "Massachusetts": "UMass",
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

function generateShortName(teamName: string): string {
  if (SHORT_NAME_OVERRIDES[teamName]) return SHORT_NAME_OVERRIDES[teamName];
  if (teamName.length <= 20) return teamName;
  return teamName.substring(0, 20);
}

// ---------------------------------------------------------------------------
// Data types for the seeder
// ---------------------------------------------------------------------------

interface TeamRecord {
  name: string;
  short_name: string;
  conference: string;
  campus_city: string;
  campus_state: string;
  campus_lat: number;
  campus_lng: number;
}

interface TeamSeasonRecord {
  team_id: string;
  season: number;
  torvik_adj_oe: number | null;
  torvik_adj_de: number | null;
  torvik_adj_em: number | null;
  off_efg_pct: number | null;
  off_to_pct: number | null;
  off_orb_pct: number | null;
  off_ft_rate: number | null;
  def_efg_pct: number | null;
  def_to_pct: number | null;
  def_orb_pct: number | null;
  def_ft_rate: number | null;
  off_three_pt_pct: number | null;
  off_three_pt_rate: number | null;
  off_ft_pct: number | null;
  def_three_pt_pct: number | null;
  def_three_pt_rate: number | null;
  def_ft_pct: number | null;
  adj_tempo: number | null;
  data_sources: string[];
}

// ---------------------------------------------------------------------------
// Helper: convert NaN to null
// ---------------------------------------------------------------------------

function nanToNull(value: number | undefined): number | null {
  if (value === undefined || value === null || isNaN(value)) return null;
  return value;
}

// ---------------------------------------------------------------------------
// Helper: sleep
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Per-season stats
// ---------------------------------------------------------------------------

interface SeasonStats {
  season: number;
  teamsUpserted: number;
  teamSeasonsUpserted: number;
  nameMappingsUpserted: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Seeder class (handles one season at a time)
// ---------------------------------------------------------------------------

class HistoricalTorvikSeeder {
  private supabase: SupabaseClient<Database>;
  private season: number;
  private teamIdMap: Map<string, string> = new Map(); // team_name -> team_id
  private stats: SeasonStats;

  constructor(
    supabase: SupabaseClient<Database>,
    season: number,
    existingTeamIdMap?: Map<string, string>
  ) {
    this.supabase = supabase;
    this.season = season;
    // Carry forward the team ID map from previous seasons to avoid re-fetching
    if (existingTeamIdMap) {
      this.teamIdMap = new Map(existingTeamIdMap);
    }
    this.stats = {
      season,
      teamsUpserted: 0,
      teamSeasonsUpserted: 0,
      nameMappingsUpserted: 0,
      errors: 0,
    };
  }

  /**
   * Returns the team ID map after processing (to carry forward to the next season).
   */
  getTeamIdMap(): Map<string, string> {
    return this.teamIdMap;
  }

  /**
   * Returns the stats for this season.
   */
  getStats(): SeasonStats {
    return { ...this.stats };
  }

  /**
   * Main entry point: fetches, normalizes, and seeds all data for one season.
   */
  async run(): Promise<boolean> {
    console.log(`\n--- Season ${this.season} ---`);

    // Step 1: Fetch
    const rawData = await this.fetchData();
    if (!rawData) return false;

    // Step 2: Normalize
    const normalized = this.normalizeData(rawData);
    if (!normalized) return false;

    // Step 3: Upsert teams
    await this.upsertTeams(normalized);

    // Step 4: Upsert team seasons
    await this.upsertTeamSeasons(normalized);

    // Step 5: Upsert name mappings
    await this.upsertNameMappings(normalized);

    // Step 6: Record import job
    await this.recordImportJob();

    return true;
  }

  // -------------------------------------------------------------------------
  // Step 1: Fetch Torvik data
  // -------------------------------------------------------------------------

  private async fetchData(): Promise<
    Awaited<ReturnType<typeof fetchTorvikData>>["data"] | null
  > {
    console.log(`  [1/6] Fetching Torvik data for ${this.season}...`);
    console.log(
      "    (This may take ~10 seconds due to crawl delay between requests)"
    );

    try {
      const result = await fetchTorvikData(this.season, {
        crawlDelayMs: CRAWL_DELAY_MS,
      });

      if (result.errors.length > 0) {
        console.warn(`    Fetch warnings (${result.errors.length}):`);
        for (const err of result.errors.slice(0, 5)) {
          console.warn(`      - ${err}`);
        }
        if (result.errors.length > 5) {
          console.warn(`      ... and ${result.errors.length - 5} more`);
        }
      }

      if (result.data.length === 0) {
        console.error(
          `    ERROR: No data returned from Torvik for ${this.season}. Skipping.`
        );
        return null;
      }

      console.log(
        `    Fetched ${result.data.length} teams from Torvik for ${this.season}.`
      );
      return result.data;
    } catch (err) {
      console.error(
        `    ERROR: Failed to fetch Torvik data for ${this.season}:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Normalize data
  // -------------------------------------------------------------------------

  private normalizeData(
    rawData: Awaited<ReturnType<typeof fetchTorvikData>>["data"]
  ): Partial<TeamSeason>[] | null {
    console.log(`  [2/6] Normalizing data for ${this.season}...`);

    try {
      const result = normalizeTorvik(rawData, this.season);

      if (result.errors.length > 0) {
        console.warn(
          `    Normalization warnings (${result.errors.length}):`
        );
        for (const err of result.errors.slice(0, 5)) {
          console.warn(
            `      - Row ${err.row}, field "${err.field}": ${err.message}`
          );
        }
        if (result.errors.length > 5) {
          console.warn(`      ... and ${result.errors.length - 5} more`);
        }
      }

      const validRecords = result.data.filter((r) => r.team?.name);
      console.log(
        `    Normalized ${validRecords.length} valid team records for ${this.season}.`
      );
      return validRecords;
    } catch (err) {
      console.error(
        `    ERROR: Failed to normalize data for ${this.season}:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Upsert teams
  // -------------------------------------------------------------------------

  private async upsertTeams(records: Partial<TeamSeason>[]): Promise<void> {
    console.log(`  [3/6] Upserting teams for ${this.season}...`);

    const teamRecords: TeamRecord[] = records
      .filter((r) => r.team?.name)
      .map((r) => {
        const team = r.team!;
        const campus = getCampusLocation(team.name);
        return {
          name: team.name,
          short_name: generateShortName(team.name),
          conference: team.conference || "Unknown",
          campus_city: campus.city,
          campus_state: campus.state,
          campus_lat: campus.lat,
          campus_lng: campus.lng,
        };
      });

    // Deduplicate by name (some records might have the same team)
    const uniqueTeams = new Map<string, TeamRecord>();
    for (const team of teamRecords) {
      uniqueTeams.set(team.name, team);
    }
    const deduped = Array.from(uniqueTeams.values());

    console.log(`    Upserting ${deduped.length} unique teams...`);

    // Process in batches
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const batch = deduped.slice(i, i + BATCH_SIZE);

      const { data, error } = await this.supabase
        .from("teams")
        .upsert(batch, {
          onConflict: "name",
          ignoreDuplicates: false,
        })
        .select("id, name");

      if (error) {
        console.error(
          `    ERROR upserting teams batch ${i / BATCH_SIZE + 1}:`,
          error.message
        );
        this.stats.errors++;

        // Try individual inserts for the failing batch
        for (const team of batch) {
          const { data: singleData, error: singleError } = await this.supabase
            .from("teams")
            .upsert(team, { onConflict: "name", ignoreDuplicates: false })
            .select("id, name");

          if (singleError) {
            console.error(
              `      Failed to upsert team "${team.name}": ${singleError.message}`
            );
            this.stats.errors++;
          } else if (singleData && singleData.length > 0) {
            this.teamIdMap.set(singleData[0].name, singleData[0].id);
            this.stats.teamsUpserted++;
          }
        }
      } else if (data) {
        for (const row of data) {
          this.teamIdMap.set(row.name, row.id);
          this.stats.teamsUpserted++;
        }
      }

      // Progress indicator
      const processed = Math.min(i + BATCH_SIZE, deduped.length);
      process.stdout.write(
        `    Progress: ${processed}/${deduped.length} teams\r`
      );
    }

    // If the upsert didn't return data (some Supabase versions), fetch all team IDs
    if (this.teamIdMap.size === 0) {
      console.log("    Fetching team IDs from database...");
      const { data: allTeams, error: fetchError } = await this.supabase
        .from("teams")
        .select("id, name");

      if (fetchError) {
        console.error("    ERROR fetching team IDs:", fetchError.message);
        return;
      }

      if (allTeams) {
        for (const team of allTeams) {
          this.teamIdMap.set(team.name, team.id);
        }
      }
    }

    console.log(
      `    Upserted ${this.stats.teamsUpserted} teams. ID map has ${this.teamIdMap.size} entries.`
    );
  }

  // -------------------------------------------------------------------------
  // Step 4: Upsert team seasons
  // -------------------------------------------------------------------------

  private async upsertTeamSeasons(
    records: Partial<TeamSeason>[]
  ): Promise<void> {
    console.log(`  [4/6] Upserting team seasons for ${this.season}...`);

    const seasonRecords: TeamSeasonRecord[] = [];

    for (const record of records) {
      const teamName = record.team?.name;
      if (!teamName) continue;

      const teamId = this.teamIdMap.get(teamName);
      if (!teamId) {
        console.warn(
          `    WARNING: No team ID found for "${teamName}", skipping season record.`
        );
        this.stats.errors++;
        continue;
      }

      const torvik = record.ratings?.torvik;

      seasonRecords.push({
        team_id: teamId,
        season: this.season,
        torvik_adj_oe: nanToNull(torvik?.adjOE),
        torvik_adj_de: nanToNull(torvik?.adjDE),
        torvik_adj_em: nanToNull(torvik?.adjEM),
        off_efg_pct: nanToNull(record.fourFactorsOffense?.efgPct),
        off_to_pct: nanToNull(record.fourFactorsOffense?.toPct),
        off_orb_pct: nanToNull(record.fourFactorsOffense?.orbPct),
        off_ft_rate: nanToNull(record.fourFactorsOffense?.ftRate),
        def_efg_pct: nanToNull(record.fourFactorsDefense?.efgPct),
        def_to_pct: nanToNull(record.fourFactorsDefense?.toPct),
        def_orb_pct: nanToNull(record.fourFactorsDefense?.orbPct),
        def_ft_rate: nanToNull(record.fourFactorsDefense?.ftRate),
        off_three_pt_pct: nanToNull(record.shootingOffense?.threePtPct),
        off_three_pt_rate: nanToNull(record.shootingOffense?.threePtRate),
        off_ft_pct: nanToNull(record.shootingOffense?.ftPct),
        def_three_pt_pct: nanToNull(record.shootingDefense?.threePtPct),
        def_three_pt_rate: nanToNull(record.shootingDefense?.threePtRate),
        def_ft_pct: nanToNull(record.shootingDefense?.ftPct),
        adj_tempo: nanToNull(record.adjTempo),
        data_sources: ["torvik"],
      });
    }

    console.log(
      `    Upserting ${seasonRecords.length} team season records...`
    );

    for (let i = 0; i < seasonRecords.length; i += BATCH_SIZE) {
      const batch = seasonRecords.slice(i, i + BATCH_SIZE);

      const { error } = await this.supabase
        .from("team_seasons")
        .upsert(batch as any, {
          onConflict: "team_id,season",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(
          `    ERROR upserting team_seasons batch ${i / BATCH_SIZE + 1}:`,
          error.message
        );

        // Try individual inserts for the failing batch
        for (const record of batch) {
          const { error: singleError } = await this.supabase
            .from("team_seasons")
            .upsert(record as any, {
              onConflict: "team_id,season",
              ignoreDuplicates: false,
            });

          if (singleError) {
            console.error(
              `      Failed to upsert season for team_id=${record.team_id}: ${singleError.message}`
            );
            this.stats.errors++;
          } else {
            this.stats.teamSeasonsUpserted++;
          }
        }
      } else {
        this.stats.teamSeasonsUpserted += batch.length;
      }

      const processed = Math.min(i + BATCH_SIZE, seasonRecords.length);
      process.stdout.write(
        `    Progress: ${processed}/${seasonRecords.length} team seasons\r`
      );
    }

    console.log(
      `    Upserted ${this.stats.teamSeasonsUpserted} team season records.`
    );
  }

  // -------------------------------------------------------------------------
  // Step 5: Upsert name mappings
  // -------------------------------------------------------------------------

  private async upsertNameMappings(
    records: Partial<TeamSeason>[]
  ): Promise<void> {
    console.log(`  [5/6] Upserting team name mappings for ${this.season}...`);

    interface NameMapping {
      team_id: string;
      kenpom_name: string;
      torvik_name: string;
      evanmiya_name: string;
    }

    const mappings: NameMapping[] = [];
    const seen = new Set<string>();

    for (const record of records) {
      const teamName = record.team?.name;
      if (!teamName) continue;
      if (seen.has(teamName)) continue;
      seen.add(teamName);

      const teamId = this.teamIdMap.get(teamName);
      if (!teamId) continue;

      // Use Torvik name as default for all sources.
      // KenPom and Evan Miya names should be updated when those sources
      // are imported.
      mappings.push({
        team_id: teamId,
        kenpom_name: teamName,
        torvik_name: teamName,
        evanmiya_name: teamName,
      });
    }

    console.log(`    Upserting ${mappings.length} name mappings...`);

    for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
      const batch = mappings.slice(i, i + BATCH_SIZE);

      const { error } = await this.supabase
        .from("team_name_mappings")
        .upsert(batch, {
          onConflict: "team_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(
          `    ERROR upserting name_mappings batch ${i / BATCH_SIZE + 1}:`,
          error.message
        );

        // Try individual inserts for the failing batch
        for (const mapping of batch) {
          const { error: singleError } = await this.supabase
            .from("team_name_mappings")
            .upsert(mapping, {
              onConflict: "team_id",
              ignoreDuplicates: false,
            });

          if (singleError) {
            // If it's a unique constraint on torvik_name, try updating just the mapping
            if (
              singleError.message.includes(
                "team_name_mappings_torvik_unique"
              )
            ) {
              // This team already has a mapping with a different team_id — skip
              console.warn(
                `      Skipping duplicate torvik_name mapping for "${mapping.torvik_name}"`
              );
            } else {
              console.error(
                `      Failed to upsert mapping for team_id=${mapping.team_id}: ${singleError.message}`
              );
            }
            this.stats.errors++;
          } else {
            this.stats.nameMappingsUpserted++;
          }
        }
      } else {
        this.stats.nameMappingsUpserted += batch.length;
      }

      const processed = Math.min(i + BATCH_SIZE, mappings.length);
      process.stdout.write(
        `    Progress: ${processed}/${mappings.length} mappings\r`
      );
    }

    console.log(
      `    Upserted ${this.stats.nameMappingsUpserted} name mappings.`
    );
  }

  // -------------------------------------------------------------------------
  // Step 6: Record import job
  // -------------------------------------------------------------------------

  private async recordImportJob(): Promise<void> {
    console.log(`  [6/6] Recording import job for ${this.season}...`);

    try {
      const { error } = await this.supabase.from("import_jobs").insert({
        source: "torvik" as const,
        season: this.season,
        status: "complete" as const,
        teams_imported: this.stats.teamSeasonsUpserted,
        validation: {
          teamsUpserted: this.stats.teamsUpserted,
          teamSeasonsUpserted: this.stats.teamSeasonsUpserted,
          nameMappingsUpserted: this.stats.nameMappingsUpserted,
          errors: this.stats.errors,
        },
      });

      if (error) {
        console.warn(
          `    WARNING: Failed to record import job: ${error.message}`
        );
        console.warn("    (Data was still imported successfully.)");
      } else {
        console.log("    Import job recorded.");
      }
    } catch (err) {
      console.warn(
        "    WARNING: Failed to record import job:",
        err instanceof Error ? err.message : err
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Load environment variables from .env.local if dotenv is available
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
  } catch {
    // dotenv not installed — environment variables must be set externally
  }

  // Parse seasons from command line arguments
  const args = process.argv.slice(2);
  let seasons: number[];

  if (args.length === 0) {
    seasons = DEFAULT_SEASONS;
    console.log(
      `No seasons specified. Defaulting to: ${seasons.join(", ")}`
    );
  } else {
    seasons = args.map((arg) => {
      const parsed = parseInt(arg, 10);
      if (isNaN(parsed) || parsed < 2002 || parsed > 2100) {
        console.error(
          `Invalid season: ${arg}. Must be between 2002 and 2100.`
        );
        process.exit(1);
      }
      return parsed;
    });
  }

  // Validate environment
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Create a shared Supabase client
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("=== Historical Torvik Data Seeder ===");
  console.log(`Seasons: ${seasons.join(", ")}`);
  console.log(`Target: Supabase (service role)`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Inter-season delay: ${INTER_SEASON_DELAY_MS / 1000}s`);
  console.log();

  // Process each season sequentially
  const allStats: SeasonStats[] = [];
  let teamIdMap = new Map<string, string>();

  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];

    console.log(
      `\n========================================`
    );
    console.log(
      `  Processing season ${i + 1} of ${seasons.length}: ${season}`
    );
    console.log(
      `========================================`
    );

    const seeder = new HistoricalTorvikSeeder(supabase, season, teamIdMap);
    const success = await seeder.run();

    // Carry forward the team ID map to avoid re-fetching for subsequent seasons
    teamIdMap = seeder.getTeamIdMap();
    allStats.push(seeder.getStats());

    if (!success) {
      console.warn(
        `\n  WARNING: Season ${season} failed to process. Continuing with remaining seasons.`
      );
    }

    // Rate-limit between seasons (skip delay after the last season)
    if (i < seasons.length - 1) {
      console.log(
        `\n  Waiting ${INTER_SEASON_DELAY_MS / 1000}s before next season...`
      );
      await sleep(INTER_SEASON_DELAY_MS);
    }
  }

  // Print overall summary
  printOverallSummary(allStats);
}

// ---------------------------------------------------------------------------
// Overall summary
// ---------------------------------------------------------------------------

function printOverallSummary(allStats: SeasonStats[]): void {
  console.log("\n");
  console.log("=".repeat(60));
  console.log("  HISTORICAL SEED COMPLETE");
  console.log("=".repeat(60));
  console.log();

  // Per-season breakdown
  console.log("Per-Season Results:");
  console.log(
    "  Season  | Teams  | Seasons | Mappings | Errors"
  );
  console.log(
    "  --------|--------|---------|----------|-------"
  );

  let totalTeams = 0;
  let totalSeasons = 0;
  let totalMappings = 0;
  let totalErrors = 0;

  for (const stats of allStats) {
    console.log(
      `  ${stats.season}    | ${String(stats.teamsUpserted).padStart(6)} | ${String(stats.teamSeasonsUpserted).padStart(7)} | ${String(stats.nameMappingsUpserted).padStart(8)} | ${String(stats.errors).padStart(6)}`
    );
    totalTeams += stats.teamsUpserted;
    totalSeasons += stats.teamSeasonsUpserted;
    totalMappings += stats.nameMappingsUpserted;
    totalErrors += stats.errors;
  }

  console.log(
    "  --------|--------|---------|----------|-------"
  );
  console.log(
    `  Total   | ${String(totalTeams).padStart(6)} | ${String(totalSeasons).padStart(7)} | ${String(totalMappings).padStart(8)} | ${String(totalErrors).padStart(6)}`
  );
  console.log();

  if (totalErrors > 0) {
    console.log(
      "Some errors occurred. Review the logs above for details."
    );
    console.log(
      "Data that succeeded is still in the database."
    );
  } else {
    console.log("All historical data seeded successfully.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
