/**
 * Seed data script: Fetches Torvik data, normalizes it, and generates
 * a comprehensive seed SQL file at `supabase/seed.sql`.
 *
 * Usage:
 *   npx tsx scripts/seed-data.ts [season]
 *
 * If no season is provided, defaults to the current season.
 *
 * The generated SQL file uses ON CONFLICT for idempotency (safe to run
 * multiple times). It inserts data into:
 *   - teams (name, short_name, conference, campus location)
 *   - team_seasons (all Torvik stats)
 *   - team_name_mappings (Torvik name -> team identity)
 *
 * @module
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// We cannot use path aliases (@/) in standalone scripts executed with tsx,
// so we import using relative paths.
// ---------------------------------------------------------------------------

import { fetchTorvikData } from "../src/lib/data/fetchers/torvik";
import { normalizeTorvik } from "../src/lib/data/normalizers/torvik";
import { getCampusLocation } from "../src/lib/data/campus-locations";
import type { TeamSeason } from "../src/types/team";
import { CURRENT_SEASON } from "../src/lib/constants";

// Handle both CJS (__dirname) and ESM (import.meta.url) environments
const __script_dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const OUTPUT_PATH = path.resolve(__script_dir, "..", "supabase", "seed.sql");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes a string for safe inclusion in a SQL string literal.
 * Doubles single quotes as per SQL standard.
 */
function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Formats a number for SQL, returning "NULL" for NaN/undefined/null values.
 */
function sqlNum(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "NULL";
  return String(value);
}

/**
 * Generates a deterministic short name from a full team name.
 * For well-known schools, returns the common short name.
 * Otherwise returns the full name truncated.
 */
function generateShortName(teamName: string): string {
  // Common short name mappings
  const shortNames: Record<string, string> = {
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
  };

  if (shortNames[teamName]) return shortNames[teamName];

  // If already short enough, return as-is
  if (teamName.length <= 20) return teamName;

  // Truncate
  return teamName.substring(0, 20);
}

// ---------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const season = parseInt(process.argv[2] ?? String(CURRENT_SEASON), 10);

  if (isNaN(season) || season < 2002 || season > 2100) {
    console.error(`Invalid season: ${process.argv[2]}. Must be between 2002 and 2100.`);
    process.exit(1);
  }

  console.log(`=== Torvik Seed Data Generator ===`);
  console.log(`Season: ${season}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log();

  // -------------------------------------------------------------------------
  // Step 1: Fetch Torvik data
  // -------------------------------------------------------------------------
  console.log("[1/4] Fetching Torvik data...");
  const fetchResult = await fetchTorvikData(season, { crawlDelayMs: 10_000 });

  if (fetchResult.errors.length > 0) {
    console.warn(`  Fetch warnings (${fetchResult.errors.length}):`);
    for (const err of fetchResult.errors.slice(0, 10)) {
      console.warn(`    - ${err}`);
    }
    if (fetchResult.errors.length > 10) {
      console.warn(`    ... and ${fetchResult.errors.length - 10} more`);
    }
  }

  if (fetchResult.data.length === 0) {
    console.error("  ERROR: No data returned from Torvik. Aborting.");
    process.exit(1);
  }

  console.log(`  Fetched ${fetchResult.data.length} teams.`);

  // -------------------------------------------------------------------------
  // Step 2: Normalize data
  // -------------------------------------------------------------------------
  console.log("[2/4] Normalizing data...");
  const normalizeResult = normalizeTorvik(fetchResult.data, season);

  if (normalizeResult.errors.length > 0) {
    console.warn(`  Normalization warnings (${normalizeResult.errors.length}):`);
    for (const err of normalizeResult.errors.slice(0, 10)) {
      console.warn(`    - Row ${err.row}, field "${err.field}": ${err.message}`);
    }
    if (normalizeResult.errors.length > 10) {
      console.warn(`    ... and ${normalizeResult.errors.length - 10} more`);
    }
  }

  console.log(`  Normalized ${normalizeResult.data.length} team records.`);

  // -------------------------------------------------------------------------
  // Step 3: Generate SQL
  // -------------------------------------------------------------------------
  console.log("[3/4] Generating SQL...");

  const sqlParts: string[] = [];

  // Header
  sqlParts.push(`-- ============================================================================`);
  sqlParts.push(`-- Seed data for March Madness Bracket Predictor`);
  sqlParts.push(`-- Season: ${season}`);
  sqlParts.push(`-- Generated: ${new Date().toISOString()}`);
  sqlParts.push(`-- Source: barttorvik.com`);
  sqlParts.push(`--`);
  sqlParts.push(`-- This file is idempotent: safe to run multiple times.`);
  sqlParts.push(`-- Uses ON CONFLICT to update existing records.`);
  sqlParts.push(`-- ============================================================================`);
  sqlParts.push(``);
  sqlParts.push(`BEGIN;`);
  sqlParts.push(``);

  // --- Teams table ---
  sqlParts.push(`-- ---------------------------------------------------------------------------`);
  sqlParts.push(`-- 1. Teams — Core team identity`);
  sqlParts.push(`-- ---------------------------------------------------------------------------`);
  sqlParts.push(``);

  for (const record of normalizeResult.data) {
    const team = record.team;
    if (!team) continue;

    const name = sqlEscape(team.name);
    const shortName = sqlEscape(generateShortName(team.name));
    const conference = sqlEscape(team.conference || "Unknown");
    const campus = getCampusLocation(team.name);

    sqlParts.push(`INSERT INTO teams (name, short_name, conference, campus_city, campus_state, campus_lat, campus_lng)`);
    sqlParts.push(`VALUES ('${name}', '${shortName}', '${conference}', '${sqlEscape(campus.city)}', '${sqlEscape(campus.state)}', ${campus.lat}, ${campus.lng})`);
    sqlParts.push(`ON CONFLICT (name) DO UPDATE SET`);
    sqlParts.push(`  conference = EXCLUDED.conference,`);
    sqlParts.push(`  campus_city = EXCLUDED.campus_city,`);
    sqlParts.push(`  campus_state = EXCLUDED.campus_state,`);
    sqlParts.push(`  campus_lat = EXCLUDED.campus_lat,`);
    sqlParts.push(`  campus_lng = EXCLUDED.campus_lng;`);
    sqlParts.push(``);
  }

  // --- Team Seasons table ---
  sqlParts.push(`-- ---------------------------------------------------------------------------`);
  sqlParts.push(`-- 2. Team Seasons — Season statistics from Torvik`);
  sqlParts.push(`-- ---------------------------------------------------------------------------`);
  sqlParts.push(``);

  for (const record of normalizeResult.data) {
    const team = record.team;
    if (!team) continue;

    const name = sqlEscape(team.name);
    const torvik = record.ratings?.torvik;

    sqlParts.push(`INSERT INTO team_seasons (team_id, season, torvik_adj_oe, torvik_adj_de, torvik_adj_em,`);
    sqlParts.push(`  off_efg_pct, off_to_pct, off_orb_pct, off_ft_rate,`);
    sqlParts.push(`  def_efg_pct, def_to_pct, def_orb_pct, def_ft_rate,`);
    sqlParts.push(`  off_three_pt_pct, off_three_pt_rate, off_ft_pct,`);
    sqlParts.push(`  def_three_pt_pct, def_three_pt_rate, def_ft_pct,`);
    sqlParts.push(`  adj_tempo, data_sources)`);
    sqlParts.push(`SELECT t.id, ${season},`);
    sqlParts.push(`  ${sqlNum(torvik?.adjOE)}, ${sqlNum(torvik?.adjDE)}, ${sqlNum(torvik?.adjEM)},`);
    sqlParts.push(`  ${sqlNum(record.fourFactorsOffense?.efgPct)}, ${sqlNum(record.fourFactorsOffense?.toPct)}, ${sqlNum(record.fourFactorsOffense?.orbPct)}, ${sqlNum(record.fourFactorsOffense?.ftRate)},`);
    sqlParts.push(`  ${sqlNum(record.fourFactorsDefense?.efgPct)}, ${sqlNum(record.fourFactorsDefense?.toPct)}, ${sqlNum(record.fourFactorsDefense?.orbPct)}, ${sqlNum(record.fourFactorsDefense?.ftRate)},`);
    sqlParts.push(`  ${sqlNum(record.shootingOffense?.threePtPct)}, ${sqlNum(record.shootingOffense?.threePtRate)}, ${sqlNum(record.shootingOffense?.ftPct)},`);
    sqlParts.push(`  ${sqlNum(record.shootingDefense?.threePtPct)}, ${sqlNum(record.shootingDefense?.threePtRate)}, ${sqlNum(record.shootingDefense?.ftPct)},`);
    sqlParts.push(`  ${sqlNum(record.adjTempo)}, ARRAY['torvik']::data_source[]`);
    sqlParts.push(`FROM teams t WHERE t.name = '${name}'`);
    sqlParts.push(`ON CONFLICT (team_id, season) DO UPDATE SET`);
    sqlParts.push(`  torvik_adj_oe = EXCLUDED.torvik_adj_oe,`);
    sqlParts.push(`  torvik_adj_de = EXCLUDED.torvik_adj_de,`);
    sqlParts.push(`  torvik_adj_em = EXCLUDED.torvik_adj_em,`);
    sqlParts.push(`  off_efg_pct = EXCLUDED.off_efg_pct,`);
    sqlParts.push(`  off_to_pct = EXCLUDED.off_to_pct,`);
    sqlParts.push(`  off_orb_pct = EXCLUDED.off_orb_pct,`);
    sqlParts.push(`  off_ft_rate = EXCLUDED.off_ft_rate,`);
    sqlParts.push(`  def_efg_pct = EXCLUDED.def_efg_pct,`);
    sqlParts.push(`  def_to_pct = EXCLUDED.def_to_pct,`);
    sqlParts.push(`  def_orb_pct = EXCLUDED.def_orb_pct,`);
    sqlParts.push(`  def_ft_rate = EXCLUDED.def_ft_rate,`);
    sqlParts.push(`  off_three_pt_pct = EXCLUDED.off_three_pt_pct,`);
    sqlParts.push(`  off_three_pt_rate = EXCLUDED.off_three_pt_rate,`);
    sqlParts.push(`  off_ft_pct = EXCLUDED.off_ft_pct,`);
    sqlParts.push(`  def_three_pt_pct = EXCLUDED.def_three_pt_pct,`);
    sqlParts.push(`  def_three_pt_rate = EXCLUDED.def_three_pt_rate,`);
    sqlParts.push(`  def_ft_pct = EXCLUDED.def_ft_pct,`);
    sqlParts.push(`  adj_tempo = EXCLUDED.adj_tempo,`);
    sqlParts.push(`  data_sources = ARRAY(SELECT DISTINCT unnest(team_seasons.data_sources || EXCLUDED.data_sources));`);
    sqlParts.push(``);
  }

  // --- Team Name Mappings table ---
  sqlParts.push(`-- ---------------------------------------------------------------------------`);
  sqlParts.push(`-- 3. Team Name Mappings — Source-specific names to canonical team IDs`);
  sqlParts.push(`-- ---------------------------------------------------------------------------`);
  sqlParts.push(``);

  for (const record of normalizeResult.data) {
    const team = record.team;
    if (!team) continue;

    const name = sqlEscape(team.name);

    // For now, use the Torvik name as the default for all sources.
    // KenPom and Evan Miya names can be updated later when those sources are imported.
    sqlParts.push(`INSERT INTO team_name_mappings (team_id, kenpom_name, torvik_name, evanmiya_name)`);
    sqlParts.push(`SELECT t.id, '${name}', '${name}', '${name}'`);
    sqlParts.push(`FROM teams t WHERE t.name = '${name}'`);
    sqlParts.push(`ON CONFLICT (team_id) DO UPDATE SET`);
    sqlParts.push(`  torvik_name = EXCLUDED.torvik_name;`);
    sqlParts.push(``);
  }

  sqlParts.push(`COMMIT;`);
  sqlParts.push(``);
  sqlParts.push(`-- End of seed data`);

  // -------------------------------------------------------------------------
  // Step 4: Write SQL file
  // -------------------------------------------------------------------------
  console.log("[4/4] Writing SQL file...");

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sqlContent = sqlParts.join("\n");
  fs.writeFileSync(OUTPUT_PATH, sqlContent, "utf-8");

  console.log();
  console.log(`Seed SQL file written to: ${OUTPUT_PATH}`);
  console.log(`  Teams: ${normalizeResult.data.filter((r) => r.team).length}`);
  console.log(`  File size: ${(Buffer.byteLength(sqlContent) / 1024).toFixed(1)} KB`);
  console.log();
  console.log("To apply the seed data, run:");
  console.log("  psql $DATABASE_URL < supabase/seed.sql");
  console.log("  -- or --");
  console.log("  supabase db reset  (if using Supabase CLI locally)");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
