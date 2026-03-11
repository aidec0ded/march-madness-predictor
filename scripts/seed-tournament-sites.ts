#!/usr/bin/env npx tsx
/**
 * Tournament Sites Seeder — ingests tournament venue locations from CSV.
 *
 * Reads a CSV file with columns: Round, Region, City, State
 * Maps cities to coordinates, deduplicates multi-round/multi-region rows,
 * and upserts to the tournament_sites table in Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-tournament-sites.ts                        # Default: season 2026
 *   npx tsx scripts/seed-tournament-sites.ts --season 2026          # Explicit season
 *   npx tsx scripts/seed-tournament-sites.ts --season 2026 --dry-run
 *   npx tsx scripts/seed-tournament-sites.ts --csv path/to/file.csv
 *
 * @module
 */

import * as fs from "fs";
import * as path from "path";

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
}

interface SiteRecord {
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  rounds: TournamentRound[];
  regions: Region[];
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
};

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  // Skip header
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",").map((s) => s.trim());
    if (parts.length < 4) {
      console.warn(`  Skipping malformed line ${i + 1}: "${line}"`);
      continue;
    }

    rows.push({
      round: parts[0],
      region: parts[1],
      city: parts[2],
      state: parts[3],
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Deduplication & merging
// ---------------------------------------------------------------------------

function buildSiteRecords(rows: CsvRow[], season: number): SiteRecord[] {
  // Group by city+state (the unique site identifier)
  const siteMap = new Map<
    string,
    {
      city: string;
      state: string;
      rounds: Set<TournamentRound>;
      regions: Set<Region>;
    }
  >();

  for (const row of rows) {
    const key = `${row.city}, ${row.state}`;

    // Map round name
    const round = ROUND_MAP[row.round];
    if (!round) {
      console.warn(`  Unknown round "${row.round}" — skipping`);
      continue;
    }

    // Look up coordinates
    if (!CITY_COORDS[key]) {
      console.error(`  No coordinates for "${key}" — add to CITY_COORDS`);
      continue;
    }

    // Get or create site entry
    let site = siteMap.get(key);
    if (!site) {
      site = {
        city: row.city,
        state: row.state,
        rounds: new Set(),
        regions: new Set(),
      };
      siteMap.set(key, site);
    }

    site.rounds.add(round);
    if (row.region !== "N/A") {
      site.regions.add(row.region as Region);
    }
  }

  // Convert to SiteRecord array
  const records: SiteRecord[] = [];
  for (const [key, site] of siteMap) {
    const coords = CITY_COORDS[key];
    const rounds = [...site.rounds].sort();
    const regions = [...site.regions].sort();

    records.push({
      name: `${site.city} - ${rounds.join("/")}`,
      city: site.city,
      state: site.state,
      latitude: coords.lat,
      longitude: coords.lng,
      rounds: rounds as TournamentRound[],
      regions: regions as Region[],
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
      console.log(
        `  ${r.name} | ${r.city}, ${r.state} | ` +
          `(${r.latitude}, ${r.longitude}) | ` +
          `Rounds: [${r.rounds.join(", ")}] | ` +
          `Regions: [${r.regions.join(", ")}]`
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
  const season = seasonArg ? parseInt(seasonArg) : 2026;
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
    console.log(
      `  ${r.name.padEnd(30)} | ${(r.city + ", " + r.state).padEnd(35)} | ` +
        `(${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}) | ` +
        `Regions: [${r.regions.join(", ")}]`
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
