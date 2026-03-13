#!/usr/bin/env npx tsx
/**
 * Misc Stats Seeder — seeds SoS, Luck, and 2-Foul Participation from CSV.
 *
 * Reads team-misc-stats.csv (KenPom end-of-regular-season data) and upserts:
 *   - sos_net_rating, sos_off_rating, sos_def_rating
 *   - luck
 *   - two_foul_participation
 *
 * into team_seasons for the specified season.
 *
 * Usage:
 *   npx tsx scripts/seed-misc-stats.ts                     # Seed 2026 season
 *   npx tsx scripts/seed-misc-stats.ts --season 2026       # Explicit season
 *   npx tsx scripts/seed-misc-stats.ts --dry-run           # Preview only
 *
 * @module
 */

import * as fs from "fs";
import * as path from "path";
import { CURRENT_SEASON } from "../src/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CsvRow {
  team: string;
  sosNetRating: number;
  sosOffRating: number;
  sosDefRating: number;
  luck: number;
  twoFoulPct: number;
}

// ---------------------------------------------------------------------------
// CSV name → DB short_name alias map
// ---------------------------------------------------------------------------

const NAME_ALIASES: Record<string, string> = {
  "N.C. State": "NC State",
  "Stephen F. Austin": "SFA",
  "North Dakota State": "N Dakota St",
  "Miami OH": "Miami OH",
  "Long Island": "LIU",
  "Portland State": "Portland St",
  "Wright State": "Wright St",
  "Bethune-Cookman": "Beth-Cookman",
  "Tennessee State": "Tennessee St",
  "Iowa State": "Iowa St",
  "Utah State": "Utah St",
  "Michigan State": "Michigan St",
  "Ohio State": "Ohio St",
  "High Point": "High Point",
};

// ---------------------------------------------------------------------------
// Parse CSV
// ---------------------------------------------------------------------------

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  // Skip header
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((s) => s.trim());
    if (parts.length < 6) continue;

    const team = parts[0];
    let sosOffRating = parseFloat(parts[2]);

    // Fix known data issue: Georgia ORTG SOS is 1167 (should be 116.7)
    if (sosOffRating > 200) {
      sosOffRating = sosOffRating / 10;
    }

    rows.push({
      team,
      sosNetRating: parseFloat(parts[1]),
      sosOffRating,
      sosDefRating: parseFloat(parts[3]),
      luck: parseFloat(parts[4]),
      twoFoulPct: parseFloat(parts[5]),
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Supabase seeding
// ---------------------------------------------------------------------------

async function seedToSupabase(csvRows: CsvRow[], season: number, dryRun: boolean) {
  const { createClient } = await import("@supabase/supabase-js");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch all teams to build name→id lookup
  const { data: teams, error: teamsErr } = await supabase
    .from("teams")
    .select("id, short_name, name");

  if (teamsErr || !teams) {
    console.error("Failed to fetch teams:", teamsErr);
    process.exit(1);
  }

  // Build lookup: short_name → team_id (also by full name for fallback)
  const teamByShortName = new Map<string, { id: string; shortName: string }>();
  const teamByName = new Map<string, { id: string; shortName: string }>();
  for (const t of teams) {
    const entry = { id: t.id, shortName: t.short_name };
    teamByShortName.set(t.short_name.toLowerCase(), entry);
    teamByName.set(t.name.toLowerCase(), entry);
  }

  // Fetch team_seasons for this season
  const { data: seasons, error: seasonsErr } = await supabase
    .from("team_seasons")
    .select("id, team_id")
    .eq("season", season);

  if (seasonsErr || !seasons) {
    console.error("Failed to fetch team_seasons:", seasonsErr);
    process.exit(1);
  }

  const teamSeasonByTeamId = new Map<string, string>();
  for (const ts of seasons) {
    teamSeasonByTeamId.set(ts.team_id, ts.id);
  }

  let matched = 0;
  let unmatched = 0;
  let updated = 0;

  for (const row of csvRows) {
    // Try to find team by CSV name → alias → DB short_name
    const csvName = row.team.trim();
    const aliasName = NAME_ALIASES[csvName] ?? csvName;

    let teamEntry =
      teamByShortName.get(csvName.toLowerCase()) ??
      teamByShortName.get(aliasName.toLowerCase()) ??
      teamByName.get(csvName.toLowerCase()) ??
      teamByName.get(aliasName.toLowerCase());

    if (!teamEntry) {
      // Try fuzzy: remove trailing whitespace, common variations
      const cleaned = csvName.replace(/\s+$/, "").toLowerCase();
      teamEntry = teamByShortName.get(cleaned);
    }

    if (!teamEntry) {
      console.warn(`  UNMATCHED: "${csvName}" (alias: "${aliasName}")`);
      unmatched++;
      continue;
    }

    const teamSeasonId = teamSeasonByTeamId.get(teamEntry.id);
    if (!teamSeasonId) {
      console.warn(`  NO SEASON: "${csvName}" → ${teamEntry.shortName} (no ${season} season record)`);
      unmatched++;
      continue;
    }

    matched++;

    if (dryRun) {
      console.log(
        `  WOULD UPDATE: ${csvName} → ${teamEntry.shortName} | SoS=${row.sosNetRating} Luck=${row.luck} 2FP=${row.twoFoulPct}%`
      );
      continue;
    }

    const { error: updateErr } = await supabase
      .from("team_seasons")
      .update({
        sos_net_rating: row.sosNetRating,
        sos_off_rating: row.sosOffRating,
        sos_def_rating: row.sosDefRating,
        luck: row.luck,
        two_foul_participation: row.twoFoulPct,
      })
      .eq("id", teamSeasonId);

    if (updateErr) {
      console.error(`  ERROR updating ${csvName}:`, updateErr.message);
    } else {
      updated++;
    }
  }

  console.log(`\nResults: ${matched} matched, ${updated} updated, ${unmatched} unmatched`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const seasonIdx = args.indexOf("--season");
  const season = seasonIdx >= 0 ? parseInt(args[seasonIdx + 1], 10) : CURRENT_SEASON;

  const csvPath = path.resolve(process.cwd(), "team-misc-stats.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Parsing ${csvPath}...`);
  const rows = parseCsv(csvPath);
  console.log(`Found ${rows.length} rows in CSV`);

  if (dryRun) {
    console.log("\n--- DRY RUN MODE ---\n");
  }

  // Load .env.local for Supabase credentials
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  } catch {
    // dotenv may not be installed — credentials can come from environment
  }

  await seedToSupabase(rows, season, dryRun);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
