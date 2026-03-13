/**
 * Mock bracket seeder for UI testing.
 *
 * Selects the top 64 teams by Torvik Adjusted Efficiency Margin from the
 * existing team_seasons data and assigns them plausible seeds, regions, and
 * bracket positions to populate the `tournament_entries` table.
 *
 * This produces a realistic-looking bracket for UI development and testing.
 * For the real bracket, use `seed-bracket.ts` with the actual Selection Sunday data.
 *
 * Usage:
 *   npx tsx scripts/seed-mock-bracket.ts [season]
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Service role key (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_SEASON = 2026;
const REGIONS: ("East" | "West" | "South" | "Midwest")[] = [
  "East",
  "West",
  "South",
  "Midwest",
];

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const season = parseInt(process.argv[2] || String(DEFAULT_SEASON), 10);
  console.log(`\n🏀 Mock Bracket Seeder — Season ${season}\n`);

  // Load environment variables
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
  } catch {
    // dotenv not installed — environment variables must be set externally
  }

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Step 1: Fetch all team_seasons for this season, ordered by Torvik AdjEM
  console.log("📊 Fetching team_seasons ranked by Torvik AdjEM...");
  const { data: teamSeasons, error: fetchError } = await supabase
    .from("team_seasons")
    .select("id, team_id, torvik_adj_em, torvik_adj_oe, torvik_adj_de")
    .eq("season", season)
    .not("torvik_adj_em", "is", null)
    .order("torvik_adj_em", { ascending: false });

  if (fetchError || !teamSeasons) {
    console.error("❌ Failed to fetch team_seasons:", fetchError?.message);
    process.exit(1);
  }

  console.log(`   Found ${teamSeasons.length} teams with Torvik data.`);

  if (teamSeasons.length < 64) {
    console.error(
      `❌ Need at least 64 teams with Torvik AdjEM data, but only found ${teamSeasons.length}.`
    );
    process.exit(1);
  }

  // Step 2: Select top 64 teams
  const top64 = teamSeasons.slice(0, 64);
  console.log(
    `✅ Selected top 64 teams (AdjEM range: ${top64[0].torvik_adj_em?.toFixed(1)} to ${top64[63].torvik_adj_em?.toFixed(1)})\n`
  );

  // Step 3: Assign seeds and regions
  // Strategy: Distribute teams into 4 regions, assigning seeds 1-16 based on rank.
  // Standard NCAA bracket structure: each region gets seeds 1 through 16.
  // Seed line N is filled by teams ranked 4*(N-1)+1 through 4*N, distributed across regions.
  //
  // For a realistic bracket, we use the "S-curve" seeding:
  // Seed 1s: #1→East, #2→West, #3→South, #4→Midwest
  // Seed 2s: #5→Midwest, #6→South, #7→West, #8→East  (reversed for balance)
  // Seed 3s: #9→East, #10→West, #11→South, #12→Midwest
  // ... and so on, alternating direction each seed line.

  interface BracketEntry {
    team_season_id: string;
    team_id: string;
    season: number;
    seed: number;
    region: "East" | "West" | "South" | "Midwest";
    bracket_position: number;
  }

  const entries: BracketEntry[] = [];

  for (let seedLine = 1; seedLine <= 16; seedLine++) {
    const startIdx = (seedLine - 1) * 4;
    const teamsForSeedLine = top64.slice(startIdx, startIdx + 4);

    // Alternate region assignment direction per seed line (S-curve)
    const regionOrder =
      seedLine % 2 === 1
        ? [...REGIONS] // East, West, South, Midwest
        : [...REGIONS].reverse(); // Midwest, South, West, East

    teamsForSeedLine.forEach((team, i) => {
      entries.push({
        team_season_id: team.id,
        team_id: team.team_id,
        season,
        seed: seedLine,
        region: regionOrder[i],
        bracket_position: seedLine, // bracket_position == seed for standard bracket
      });
    });
  }

  // Validate: should have 64 entries, 16 per region, each seed 1-16 once per region
  const regionCounts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.region;
    regionCounts.set(key, (regionCounts.get(key) || 0) + 1);
  }
  for (const region of REGIONS) {
    const count = regionCounts.get(region) || 0;
    if (count !== 16) {
      console.error(
        `❌ Region ${region} has ${count} teams, expected 16. This is a bug.`
      );
      process.exit(1);
    }
  }

  // Step 4: Clear existing tournament entries for this season
  console.log("🗑️  Clearing existing tournament entries...");
  const { error: deleteError } = await supabase
    .from("tournament_entries")
    .delete()
    .eq("season", season);

  if (deleteError) {
    console.error(
      "❌ Failed to clear tournament entries:",
      deleteError.message
    );
    process.exit(1);
  }

  // Step 5: Insert new entries
  console.log("💾 Inserting 64 tournament entries...\n");
  const { error: insertError } = await supabase
    .from("tournament_entries")
    .insert(entries);

  if (insertError) {
    console.error(
      "❌ Failed to insert tournament entries:",
      insertError.message
    );
    process.exit(1);
  }

  // Step 6: Fetch team names for display
  const teamIds = entries.map((e) => e.team_id);
  const { data: teams } = await supabase
    .from("teams")
    .select("id, short_name")
    .in("id", teamIds);

  const teamNameMap = new Map<string, string>();
  if (teams) {
    for (const team of teams) {
      teamNameMap.set(team.id, team.short_name);
    }
  }

  // Step 7: Display the bracket
  console.log("🏆 Mock Bracket for Season " + season + ":\n");
  for (const region of REGIONS) {
    console.log(`  ── ${region} Region ──`);
    const regionEntries = entries
      .filter((e) => e.region === region)
      .sort((a, b) => a.seed - b.seed);

    for (const entry of regionEntries) {
      const name = teamNameMap.get(entry.team_id) || "Unknown";
      const team = top64.find((t) => t.team_id === entry.team_id);
      const adjEM = team?.torvik_adj_em?.toFixed(1) ?? "N/A";
      console.log(
        `    ${String(entry.seed).padStart(2)}. ${name.padEnd(20)} (AdjEM: ${adjEM})`
      );
    }
    console.log();
  }

  console.log("✅ Mock bracket seeded successfully! Visit /bracket to test.\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
