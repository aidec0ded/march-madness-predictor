/**
 * Mock bracket seeder for UI testing.
 *
 * Selects the top 68 teams by Torvik Adjusted Efficiency Margin from the
 * existing team_seasons data and assigns them plausible seeds, regions, and
 * bracket positions to populate the `tournament_entries` table.
 *
 * By default, seeds a 68-team bracket with 4 First Four play-in games
 * (2 at the 16-seed line, 2 at the 11-seed line). Use --no-play-ins to
 * seed the classic 64-team bracket instead.
 *
 * This produces a realistic-looking bracket for UI development and testing.
 * For the real bracket, use `seed-bracket.ts` with the actual Selection Sunday data.
 *
 * Usage:
 *   npx tsx scripts/seed-mock-bracket.ts [season] [--no-play-ins]
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
type Region = "East" | "West" | "South" | "Midwest";
const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

/**
 * In the NCAA tournament, the First Four play-in games are always at the
 * 16-seed line (2 games) and 11-seed line (2 games). We replicate that.
 *
 * The play-in seeds and which regions get them:
 * - 16-seed play-ins: assigned to the first two regions in S-curve order
 * - 11-seed play-ins: assigned to the last two regions in S-curve order
 */
const PLAY_IN_SEEDS = [16, 11] as const;

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
  // Parse CLI args
  const args = process.argv.slice(2);
  const noPlayIns = args.includes("--no-play-ins");
  const seasonArg = args.find((a) => !a.startsWith("--"));
  const season = parseInt(seasonArg || String(DEFAULT_SEASON), 10);
  const totalTeams = noPlayIns ? 64 : 68;

  console.log(
    `\n🏀 Mock Bracket Seeder — Season ${season} (${totalTeams}-team${noPlayIns ? "" : " with First Four"})\n`
  );

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

  if (teamSeasons.length < totalTeams) {
    console.error(
      `❌ Need at least ${totalTeams} teams with Torvik AdjEM data, but only found ${teamSeasons.length}.`
    );
    process.exit(1);
  }

  // Step 2: Select teams
  const topTeams = teamSeasons.slice(0, totalTeams);
  console.log(
    `✅ Selected top ${totalTeams} teams (AdjEM range: ${topTeams[0].torvik_adj_em?.toFixed(1)} to ${topTeams[totalTeams - 1].torvik_adj_em?.toFixed(1)})\n`
  );

  // Step 3: Assign seeds and regions
  //
  // Standard S-curve seeding distributes teams into 4 regions:
  // Seed 1s: #1→East, #2→West, #3→South, #4→Midwest
  // Seed 2s: #5→Midwest, #6→South, #7→West, #8→East  (reversed for balance)
  // ... alternating direction each seed line.
  //
  // For 68-team brackets, play-in seed lines get 8 teams (2 per region pair)
  // instead of 4. The play-in regions are:
  //   16-seed play-ins: first two regions in S-curve order for that seed line
  //   11-seed play-ins: last two regions in S-curve order for that seed line
  //
  // This produces 2 play-in games at the 16-seed line and 2 at the 11-seed line,
  // matching the real NCAA format.

  interface BracketEntry {
    team_season_id: string;
    team_id: string;
    season: number;
    seed: number;
    region: Region;
    bracket_position: number;
  }

  const entries: BracketEntry[] = [];

  // Track which slots are play-in pairs for display
  const playInSlots = new Set<string>(); // "region-seed" keys

  if (noPlayIns) {
    // Classic 64-team bracket: 4 teams per seed line, no duplicates
    for (let seedLine = 1; seedLine <= 16; seedLine++) {
      const startIdx = (seedLine - 1) * 4;
      const teamsForSeedLine = topTeams.slice(startIdx, startIdx + 4);

      const regionOrder =
        seedLine % 2 === 1
          ? [...REGIONS]
          : [...REGIONS].reverse();

      teamsForSeedLine.forEach((team, i) => {
        entries.push({
          team_season_id: team.id,
          team_id: team.team_id,
          season,
          seed: seedLine,
          region: regionOrder[i],
          bracket_position: seedLine,
        });
      });
    }
  } else {
    // 68-team bracket with First Four play-ins
    //
    // Approach: Assign 64 "base" teams using S-curve, then add 4 extra teams
    // as play-in opponents at the designated slots.
    //
    // The 4 play-in slots are:
    //   - 16-seed in the first two S-curve regions for seed line 16
    //   - 11-seed in the first two S-curve regions for seed line 11
    //
    // For each play-in slot, we take the NEXT available team from the pool
    // (ranked #65-68) and give them the same seed+region, creating a duplicate
    // that the app's detectPlayInPairs() will pick up.

    // First, assign 64 base teams using S-curve (identical to the 64-team path)
    const base64 = topTeams.slice(0, 64);
    for (let seedLine = 1; seedLine <= 16; seedLine++) {
      const startIdx = (seedLine - 1) * 4;
      const teamsForSeedLine = base64.slice(startIdx, startIdx + 4);

      const regionOrder =
        seedLine % 2 === 1
          ? [...REGIONS]
          : [...REGIONS].reverse();

      teamsForSeedLine.forEach((team, i) => {
        entries.push({
          team_season_id: team.id,
          team_id: team.team_id,
          season,
          seed: seedLine,
          region: regionOrder[i],
          bracket_position: seedLine,
        });
      });
    }

    // Now add 4 play-in opponents from teams #65-68
    const playInTeams = topTeams.slice(64, 68);
    let piIdx = 0;

    for (const piSeed of PLAY_IN_SEEDS) {
      // Determine which regions get play-ins for this seed line.
      // Use the S-curve region order for this seed line, pick the first 2.
      const regionOrder =
        piSeed % 2 === 1
          ? [...REGIONS]
          : [...REGIONS].reverse();
      const playInRegions = regionOrder.slice(0, 2);

      for (const region of playInRegions) {
        if (piIdx >= playInTeams.length) break;
        const team = playInTeams[piIdx];
        piIdx++;

        entries.push({
          team_season_id: team.id,
          team_id: team.team_id,
          season,
          seed: piSeed,
          region,
          bracket_position: piSeed,
        });
        playInSlots.add(`${region}-${piSeed}`);
      }
    }
  }

  // Validate entry count
  if (entries.length !== totalTeams) {
    console.error(
      `❌ Expected ${totalTeams} entries, got ${entries.length}. This is a bug.`
    );
    process.exit(1);
  }

  // Validate region structure
  const regionCounts = new Map<string, number>();
  for (const entry of entries) {
    regionCounts.set(entry.region, (regionCounts.get(entry.region) || 0) + 1);
  }
  for (const region of REGIONS) {
    const count = regionCounts.get(region) || 0;
    const expected = noPlayIns ? 16 : 16 + [...playInSlots].filter((s) => s.startsWith(region)).length;
    if (count !== expected) {
      console.error(
        `❌ Region ${region} has ${count} teams, expected ${expected}. This is a bug.`
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
  console.log(`💾 Inserting ${totalTeams} tournament entries...\n`);
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

  // Show First Four play-in games if applicable
  if (!noPlayIns && playInSlots.size > 0) {
    console.log("  ── First Four Play-In Games ──");
    for (const slotKey of [...playInSlots].sort()) {
      const [region, seedStr] = slotKey.split("-");
      const seed = parseInt(seedStr, 10);
      const slotEntries = entries.filter(
        (e) => e.region === region && e.seed === seed
      );
      const names = slotEntries.map((e) => {
        const name = teamNameMap.get(e.team_id) || "Unknown";
        const team = topTeams.find((t) => t.team_id === e.team_id);
        const adjEM = team?.torvik_adj_em?.toFixed(1) ?? "N/A";
        return `${name} (${adjEM})`;
      });
      console.log(
        `    ${region} ${seed}-seed: ${names[0]}  vs  ${names[1]}`
      );
    }
    console.log();
  }

  for (const region of REGIONS) {
    console.log(`  ── ${region} Region ──`);
    const regionEntries = entries
      .filter((e) => e.region === region)
      .sort((a, b) => a.seed - b.seed);

    // Group by seed to show play-in pairs
    const seedGroups = new Map<number, typeof regionEntries>();
    for (const entry of regionEntries) {
      const group = seedGroups.get(entry.seed);
      if (group) {
        group.push(entry);
      } else {
        seedGroups.set(entry.seed, [entry]);
      }
    }

    for (const [seed, groupEntries] of [...seedGroups].sort(
      ([a], [b]) => a - b
    )) {
      for (let i = 0; i < groupEntries.length; i++) {
        const entry = groupEntries[i];
        const name = teamNameMap.get(entry.team_id) || "Unknown";
        const team = topTeams.find((t) => t.team_id === entry.team_id);
        const adjEM = team?.torvik_adj_em?.toFixed(1) ?? "N/A";
        const playInTag =
          groupEntries.length > 1 ? ` [First Four ${i === 0 ? "A" : "B"}]` : "";
        console.log(
          `    ${String(seed).padStart(2)}. ${name.padEnd(20)} (AdjEM: ${adjEM})${playInTag}`
        );
      }
    }
    console.log();
  }

  console.log(
    `✅ Mock bracket seeded successfully! (${totalTeams} teams${noPlayIns ? "" : ", including First Four"}) Visit /bracket to test.\n`
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
