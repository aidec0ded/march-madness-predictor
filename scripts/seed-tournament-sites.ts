#!/usr/bin/env npx tsx
/**
 * Tournament Sites Seeder — ingests tournament venue locations from CSV.
 *
 * Reads a CSV file with columns: Round, Region, City, State, Arena, Seeds
 * Maps cities to coordinates, parses seed matchup assignments,
 * deduplicates multi-round/multi-region rows, and upserts to the
 * tournament_sites table in Supabase.
 *
 * The `Seeds` column is optional and only meaningful for R64/R32 pod sites.
 * It specifies which seed-line matchups are hosted at each venue.
 * Format: "1/16,8/9" means this site hosts the 1v16 and 8v9 games.
 *
 * For S16/E8/F4/NCG, leave Seeds blank — those rounds have one site per
 * region (or one national site) so no disambiguation is needed.
 *
 * Usage:
 *   npx tsx scripts/seed-tournament-sites.ts                        # Default: season 2026
 *   npx tsx scripts/seed-tournament-sites.ts --season 2026          # Explicit season
 *   npx tsx scripts/seed-tournament-sites.ts --season 2026 --dry-run
 *   npx tsx scripts/seed-tournament-sites.ts --csv path/to/file.csv
 *
 * CSV format:
 *   Round,Region,City,State,Arena,Seeds
 *   First,East,Buffalo,New York,KeyBank Center,"1/16,8/9"
 *   First,East,Tampa,Florida,Amalie Arena,"5/12,4/13"
 *   Sweet_Sixteen,East,Philadelphia,Pennsylvania,Wells Fargo Center,
 *   Final_Four,N/A,San Antonio,Texas,Alamodome,
 *
 * @module
 */

import * as fs from "fs";
import * as path from "path";
import { CURRENT_SEASON } from "../src/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TournamentRound = "R64" | "R32" | "S16" | "E8" | "F4" | "NCG";
type Region = "East" | "West" | "South" | "Midwest";

interface CsvRow {
  round: string;
  region: string;
  city: string;
  state: string;
  arena: string;
  /** Raw seeds string, e.g. "1/16,8/9" or empty */
  seeds: string;
}

interface SiteRecord {
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  rounds: TournamentRound[];
  regions: Region[];
  /** Which seed lines play here (e.g., [1,16,8,9]). Null for S16/E8/F4/NCG. */
  seed_matchups: number[] | null;
  season: number;
}

// ---------------------------------------------------------------------------
// Round name mapping
// ---------------------------------------------------------------------------

const ROUND_MAP: Record<string, TournamentRound> = {
  First_Four: "R64", // Play-in games — treated as R64 for site purposes
  First: "R64",
  Second: "R32",
  Sweet_Sixteen: "S16",
  Elite_Eight: "E8",
  Final_Four: "F4",
  National_Championship: "NCG",
};

// ---------------------------------------------------------------------------
// City coordinates (hardcoded for known tournament cities)
// ---------------------------------------------------------------------------

interface CityCoords {
  lat: number;
  lng: number;
}

const CITY_COORDS: Record<string, CityCoords> = {
  "Dayton, Ohio": { lat: 39.7589, lng: -84.1916 },
  "Buffalo, New York": { lat: 42.8864, lng: -78.8784 },
  "Greenville, South Carolina": { lat: 34.8526, lng: -82.394 },
  "Oklahoma City, Oklahoma": { lat: 35.4676, lng: -97.5164 },
  "Portland, Oregon": { lat: 45.5152, lng: -122.6784 },
  "Tampa, Florida": { lat: 27.9506, lng: -82.4572 },
  "Philadelphia, Pennsylvania": { lat: 39.9526, lng: -75.1652 },
  "San Diego, California": { lat: 32.7157, lng: -117.1611 },
  "St. Louis, Missouri": { lat: 38.627, lng: -90.1994 },
  "Houston, Texas": { lat: 29.7604, lng: -95.3698 },
  "Chicago, Illinois": { lat: 41.8781, lng: -87.6298 },
  "Washington, District of Columbia": { lat: 38.9072, lng: -77.0369 },
  "San Jose, California": { lat: 37.3382, lng: -121.8863 },
  "Indianapolis, Indiana": { lat: 39.7684, lng: -86.1581 },
  "San Antonio, Texas": { lat: 29.4241, lng: -98.4936 },
  "Denver, Colorado": { lat: 39.7392, lng: -104.9903 },
  "Cleveland, Ohio": { lat: 41.4993, lng: -81.6944 },
  "Raleigh, North Carolina": { lat: 35.7796, lng: -78.6382 },
  "Salt Lake City, Utah": { lat: 40.7608, lng: -111.891 },
  "Memphis, Tennessee": { lat: 35.1495, lng: -90.049 },
  "Nashville, Tennessee": { lat: 36.1627, lng: -86.7816 },
  "Louisville, Kentucky": { lat: 38.2527, lng: -85.7585 },
  "Atlanta, Georgia": { lat: 33.749, lng: -84.388 },
  "Dallas, Texas": { lat: 32.7767, lng: -96.797 },
  "New Orleans, Louisiana": { lat: 29.9511, lng: -90.0715 },
  "Minneapolis, Minnesota": { lat: 44.9778, lng: -93.265 },
  "Birmingham, Alabama": { lat: 33.5207, lng: -86.8025 },
  "Fort Worth, Texas": { lat: 32.7555, lng: -97.3308 },
  "Lexington, Kentucky": { lat: 38.0406, lng: -84.5037 },
  "Newark, New Jersey": { lat: 40.7357, lng: -74.1724 },
  "Albany, New York": { lat: 42.6526, lng: -73.7562 },
  "Spokane, Washington": { lat: 47.6588, lng: -117.426 },
  "Charlotte, North Carolina": { lat: 35.2271, lng: -80.8431 },
  "Detroit, Michigan": { lat: 42.3314, lng: -83.0458 },
  "Sacramento, California": { lat: 38.5816, lng: -121.4944 },
  "Omaha, Nebraska": { lat: 41.2565, lng: -95.9345 },
  "Boise, Idaho": { lat: 43.615, lng: -116.2023 },
  "Des Moines, Iowa": { lat: 41.5868, lng: -93.625 },
  "Pittsburgh, Pennsylvania": { lat: 40.4406, lng: -79.9959 },
  "Columbia, South Carolina": { lat: 34.0007, lng: -81.0348 },
  "Milwaukee, Wisconsin": { lat: 43.0389, lng: -87.9065 },
  "Jacksonville, Florida": { lat: 30.3322, lng: -81.6557 },
  "Tulsa, Oklahoma": { lat: 36.154, lng: -95.9928 },
  "Hartford, Connecticut": { lat: 41.7658, lng: -72.6734 },
  "Columbus, Ohio": { lat: 39.9612, lng: -82.9988 },
  "Tucson, Arizona": { lat: 32.2226, lng: -110.9747 },
  "Wichita, Kansas": { lat: 37.6872, lng: -97.3301 },
  "Orlando, Florida": { lat: 28.5383, lng: -81.3792 },
  "Dayton, Texas": { lat: 30.0466, lng: -94.8852 },
  "Providence, Rhode Island": { lat: 41.824, lng: -71.4128 },
  "Kansas City, Missouri": { lat: 39.0997, lng: -94.5786 },
  "Greenville, North Carolina": { lat: 35.6127, lng: -77.3664 },
};

// ---------------------------------------------------------------------------
// Seed matchup parsing
// ---------------------------------------------------------------------------

/**
 * Parses a seeds string like "1/16,8/9" into a flat array [1, 16, 8, 9].
 * Returns null if the string is empty or undefined.
 */
function parseSeedMatchups(seeds: string): number[] | null {
  const trimmed = seeds.trim().replace(/^"/, "").replace(/"$/, "").trim();
  if (!trimmed) return null;

  const allSeeds: number[] = [];
  const matchups = trimmed.split(",");

  for (const matchup of matchups) {
    const parts = matchup.trim().split("/");
    for (const part of parts) {
      const seed = parseInt(part.trim(), 10);
      if (isNaN(seed) || seed < 1 || seed > 16) {
        console.warn(`  Invalid seed value "${part}" in "${seeds}" — skipping`);
        return null;
      }
      allSeeds.push(seed);
    }
  }

  return allSeeds.length > 0 ? allSeeds : null;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parses CSV with columns: Round, Region, City, State, Arena, Seeds
 * The Seeds column is optional — trailing commas or missing values are OK.
 */
function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  // Skip header
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields (Seeds column may contain commas like "1/16,8/9")
    const parts = parseCSVLine(line);
    if (parts.length < 4) {
      console.warn(`  Skipping malformed line ${i + 1}: "${line}"`);
      continue;
    }

    rows.push({
      round: parts[0].trim(),
      region: parts[1].trim(),
      city: parts[2].trim(),
      state: parts[3].trim(),
      arena: (parts[4] || "").trim(),
      seeds: (parts[5] || "").trim(),
    });
  }

  return rows;
}

/**
 * Parses a CSV line respecting quoted fields.
 * "1/16,8/9" is treated as a single field.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Deduplication & merging
// ---------------------------------------------------------------------------

function buildSiteRecords(rows: CsvRow[], season: number): SiteRecord[] {
  // Group by city+state+region — a venue hosting different regions needs
  // separate records so seed_matchups stay region-specific.
  // National rounds (F4/NCG) use "N/A" as region.
  const siteMap = new Map<
    string,
    {
      city: string;
      state: string;
      arena: string;
      region: string; // "N/A" for national rounds
      rounds: Set<TournamentRound>;
      seedMatchups: Set<number>;
    }
  >();

  for (const row of rows) {
    const cityKey = `${row.city}, ${row.state}`;

    // Map round name
    const round = ROUND_MAP[row.round];
    if (!round) {
      console.warn(`  Unknown round "${row.round}" — skipping`);
      continue;
    }

    // Look up coordinates
    if (!CITY_COORDS[cityKey]) {
      console.error(`  ❌ No coordinates for "${cityKey}" — add to CITY_COORDS`);
      continue;
    }

    // Parse seed matchups
    const seeds = parseSeedMatchups(row.seeds);

    // Key includes region so multi-region venues get separate records
    const key = `${cityKey}|${row.region}`;

    // Get or create site entry
    let site = siteMap.get(key);
    if (!site) {
      site = {
        city: row.city,
        state: row.state,
        arena: row.arena,
        region: row.region,
        rounds: new Set(),
        seedMatchups: new Set(),
      };
      siteMap.set(key, site);
    }

    // Prefer arena names from later rows (they may be more specific)
    if (row.arena && !site.arena) {
      site.arena = row.arena;
    }

    site.rounds.add(round);

    // Accumulate seed matchups across rows (e.g. First + Second at same site)
    if (seeds) {
      for (const seed of seeds) {
        site.seedMatchups.add(seed);
      }
    }
  }

  // Check which arenas host multiple regions (need name disambiguation)
  const arenaRegionCount = new Map<string, number>();
  for (const site of siteMap.values()) {
    const arenaKey = site.arena || `${site.city} venue`;
    arenaRegionCount.set(arenaKey, (arenaRegionCount.get(arenaKey) || 0) + 1);
  }

  // Convert to SiteRecord array
  const records: SiteRecord[] = [];
  for (const [, site] of siteMap) {
    const cityKey = `${site.city}, ${site.state}`;
    const coords = CITY_COORDS[cityKey];
    const rounds = [...site.rounds].sort();
    const seedMatchups =
      site.seedMatchups.size > 0 ? [...site.seedMatchups].sort((a, b) => a - b) : null;

    const regions: Region[] =
      site.region !== "N/A" ? [site.region as Region] : [];

    // If this arena hosts multiple regions, disambiguate the name
    const baseArena = site.arena || `${site.city} - ${rounds.join("/")}`;
    const arenaKey = site.arena || `${site.city} venue`;
    const needsDisambiguation = (arenaRegionCount.get(arenaKey) || 0) > 1;
    const displayName =
      needsDisambiguation && site.region !== "N/A"
        ? `${baseArena} (${site.region})`
        : baseArena;

    records.push({
      name: displayName,
      city: site.city,
      state: site.state,
      latitude: coords.lat,
      longitude: coords.lng,
      rounds: rounds as TournamentRound[],
      regions,
      seed_matchups: seedMatchups,
      season,
    });
  }

  return records.sort((a, b) => {
    // Sort by round order, then city
    const roundOrder = ["R64", "R32", "S16", "E8", "F4", "NCG"];
    const aFirst = Math.min(...a.rounds.map((r) => roundOrder.indexOf(r)));
    const bFirst = Math.min(...b.rounds.map((r) => roundOrder.indexOf(r)));
    if (aFirst !== bFirst) return aFirst - bFirst;
    return a.city.localeCompare(b.city);
  });
}

// ---------------------------------------------------------------------------
// Supabase seeding
// ---------------------------------------------------------------------------

async function seedToSupabase(
  records: SiteRecord[],
  season: number,
  dryRun: boolean
) {
  const { createClient } = await import("@supabase/supabase-js");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  if (dryRun) {
    console.log("\n[DRY RUN] Would upsert the following sites:\n");
    for (const r of records) {
      const seedsDisplay = r.seed_matchups
        ? `Seeds: [${r.seed_matchups.join(",")}]`
        : "Seeds: all";
      console.log(
        `  ${r.name.padEnd(30)} | ${(r.city + ", " + r.state).padEnd(35)} | ` +
          `(${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}) | ` +
          `Rounds: [${r.rounds.join(", ")}] | ` +
          `Regions: [${r.regions.join(", ")}] | ` +
          seedsDisplay
      );
    }
    return;
  }

  // Delete existing sites for this season
  console.log(`\nDeleting existing sites for season ${season}...`);
  const { error: deleteError } = await supabase
    .from("tournament_sites")
    .delete()
    .eq("season", season);

  if (deleteError) {
    console.error("Failed to delete existing sites:", deleteError.message);
    process.exit(1);
  }

  // Insert new sites
  console.log(`Inserting ${records.length} sites...`);
  const { error: insertError } = await supabase
    .from("tournament_sites")
    .insert(records);

  if (insertError) {
    console.error("Failed to insert sites:", insertError.message);

    // Try one at a time to identify the failing record
    let successCount = 0;
    for (const record of records) {
      const { error } = await supabase
        .from("tournament_sites")
        .insert(record);

      if (error) {
        console.error(`  Failed: ${record.name} — ${error.message}`);
      } else {
        successCount++;
      }
    }
    console.log(`  Inserted ${successCount}/${records.length} individually.`);
    return;
  }

  console.log(`Successfully inserted ${records.length} tournament sites.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load environment variables
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
  } catch {
    // dotenv not installed — environment variables must be set externally
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const seasonArg = args.find((_, i) => args[i - 1] === "--season");
  const season = seasonArg ? parseInt(seasonArg) : CURRENT_SEASON;
  const csvArg = args.find((_, i) => args[i - 1] === "--csv");
  const csvPath = csvArg || path.join(__dirname, "..", "tourney_locations.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log("=== Tournament Sites Seeder ===");
  console.log(`CSV: ${csvPath}`);
  console.log(`Season: ${season}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

  // Parse CSV
  console.log("\nParsing CSV...");
  const rows = parseCsv(csvPath);
  console.log(`  Parsed ${rows.length} rows`);

  // Build deduplicated site records
  console.log("\nBuilding site records...");
  const records = buildSiteRecords(rows, season);
  console.log(`  Created ${records.length} unique site records:\n`);

  for (const r of records) {
    const seedsDisplay = r.seed_matchups
      ? `Seeds: [${r.seed_matchups.join(",")}]`
      : "Seeds: all";
    console.log(
      `  ${r.name.padEnd(30)} | ${(r.city + ", " + r.state).padEnd(35)} | ` +
        `(${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}) | ` +
        `Regions: [${r.regions.join(", ")}] | ` +
        seedsDisplay
    );
  }

  // Seed to Supabase
  await seedToSupabase(records, season, dryRun);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
