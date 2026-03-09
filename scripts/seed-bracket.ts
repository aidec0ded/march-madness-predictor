/**
 * Production bracket seeder for the NCAA tournament.
 *
 * Takes a JSON file with the official bracket (64 teams, seeds, regions) and
 * populates the `tournament_entries` table. Designed to run on Selection Sunday
 * after the bracket is announced.
 *
 * Usage:
 *   npx tsx scripts/seed-bracket.ts <bracket-file.json> [season]
 *
 * The JSON file should have this format:
 * ```json
 * {
 *   "season": 2026,
 *   "teams": [
 *     { "name": "UConn", "seed": 1, "region": "East" },
 *     { "name": "Houston", "seed": 1, "region": "West" },
 *     { "name": "Purdue", "seed": 1, "region": "South" },
 *     { "name": "North Carolina", "seed": 1, "region": "Midwest" },
 *     ...
 *   ]
 * }
 * ```
 *
 * Team names are matched against `teams.name`, `teams.short_name`, and
 * `team_name_mappings.torvik_name` to find the correct team_id. The script
 * reports any unmatched teams and asks for confirmation before inserting.
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Service role key (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import type { Database } from "../src/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BracketInput {
  season?: number;
  teams: BracketTeamInput[];
}

interface BracketTeamInput {
  /** Team name — matched against teams.name, teams.short_name, or team_name_mappings */
  name: string;
  /** NCAA tournament seed (1-16) */
  seed: number;
  /** Bracket region */
  region: "East" | "West" | "South" | "Midwest";
}

const VALID_REGIONS = ["East", "West", "South", "Midwest"];

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
// Validation
// ---------------------------------------------------------------------------

function validateBracketInput(input: BracketInput): string[] {
  const errors: string[] = [];

  if (!input.teams || !Array.isArray(input.teams)) {
    errors.push("Missing or invalid 'teams' array.");
    return errors;
  }

  if (input.teams.length !== 64) {
    errors.push(
      `Expected exactly 64 teams, got ${input.teams.length}.`
    );
  }

  // Validate each team entry
  for (let i = 0; i < input.teams.length; i++) {
    const team = input.teams[i];
    if (!team.name || typeof team.name !== "string") {
      errors.push(`Team at index ${i}: missing or invalid 'name'.`);
    }
    if (
      !team.seed ||
      typeof team.seed !== "number" ||
      team.seed < 1 ||
      team.seed > 16
    ) {
      errors.push(
        `Team "${team.name}" at index ${i}: seed must be 1-16, got ${team.seed}.`
      );
    }
    if (!team.region || !VALID_REGIONS.includes(team.region)) {
      errors.push(
        `Team "${team.name}" at index ${i}: region must be East/West/South/Midwest, got "${team.region}".`
      );
    }
  }

  // Validate bracket structure: 4 regions × 16 seeds
  const regionSeedCounts = new Map<string, Set<number>>();
  for (const team of input.teams) {
    if (!team.region || !team.seed) continue;
    const key = team.region;
    if (!regionSeedCounts.has(key)) {
      regionSeedCounts.set(key, new Set());
    }
    const seeds = regionSeedCounts.get(key)!;
    if (seeds.has(team.seed)) {
      errors.push(
        `Duplicate seed ${team.seed} in region ${team.region}: "${team.name}".`
      );
    }
    seeds.add(team.seed);
  }

  for (const region of VALID_REGIONS) {
    const seeds = regionSeedCounts.get(region);
    if (!seeds || seeds.size !== 16) {
      errors.push(
        `Region ${region}: expected 16 unique seeds (1-16), got ${seeds?.size ?? 0}.`
      );
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Team matching
// ---------------------------------------------------------------------------

interface TeamMatch {
  team_id: string;
  team_season_id: string;
  matched_by: string;
}

async function matchTeams(
  supabase: ReturnType<typeof createClient<Database>>,
  inputTeams: BracketTeamInput[],
  season: number
): Promise<{
  matched: Map<string, TeamMatch>;
  unmatched: string[];
}> {
  // Fetch all teams
  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, short_name");

  // Fetch name mappings
  const { data: nameMappings } = await supabase
    .from("team_name_mappings")
    .select("team_id, torvik_name, kenpom_name, evanmiya_name");

  // Fetch team_seasons for this season
  const { data: teamSeasons } = await supabase
    .from("team_seasons")
    .select("id, team_id")
    .eq("season", season);

  if (!allTeams || !teamSeasons) {
    console.error("❌ Failed to fetch team data from Supabase.");
    process.exit(1);
  }

  // Build lookup maps
  const teamsByName = new Map<string, string>(); // name/short_name -> team_id
  const teamSeasonMap = new Map<string, string>(); // team_id -> team_season_id

  for (const team of allTeams) {
    teamsByName.set(team.name.toLowerCase(), team.id);
    teamsByName.set(team.short_name.toLowerCase(), team.id);
  }

  if (nameMappings) {
    for (const mapping of nameMappings) {
      if (mapping.torvik_name)
        teamsByName.set(mapping.torvik_name.toLowerCase(), mapping.team_id);
      if (mapping.kenpom_name)
        teamsByName.set(mapping.kenpom_name.toLowerCase(), mapping.team_id);
      if (mapping.evanmiya_name)
        teamsByName.set(mapping.evanmiya_name.toLowerCase(), mapping.team_id);
    }
  }

  for (const ts of teamSeasons) {
    teamSeasonMap.set(ts.team_id, ts.id);
  }

  // Match each input team
  const matched = new Map<string, TeamMatch>();
  const unmatched: string[] = [];

  for (const inputTeam of inputTeams) {
    const normalizedName = inputTeam.name.toLowerCase().trim();
    const teamId = teamsByName.get(normalizedName);

    if (!teamId) {
      unmatched.push(inputTeam.name);
      continue;
    }

    const teamSeasonId = teamSeasonMap.get(teamId);
    if (!teamSeasonId) {
      unmatched.push(`${inputTeam.name} (no team_season for season ${season})`);
      continue;
    }

    matched.set(inputTeam.name, {
      team_id: teamId,
      team_season_id: teamSeasonId,
      matched_by: normalizedName,
    });
  }

  return { matched, unmatched };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const bracketFile = process.argv[2];
  if (!bracketFile) {
    console.error("Usage: npx tsx scripts/seed-bracket.ts <bracket-file.json> [season]");
    console.error("\nExample bracket-file.json:");
    console.error(
      JSON.stringify(
        {
          season: 2026,
          teams: [
            { name: "UConn", seed: 1, region: "East" },
            { name: "Houston", seed: 1, region: "West" },
            { name: "Purdue", seed: 1, region: "South" },
            { name: "North Carolina", seed: 1, region: "Midwest" },
          ],
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  // Read and parse bracket file
  let input: BracketInput;
  try {
    const raw = readFileSync(bracketFile, "utf-8");
    input = JSON.parse(raw) as BracketInput;
  } catch (err) {
    console.error(`❌ Failed to read/parse ${bracketFile}:`, err);
    process.exit(1);
  }

  const season = parseInt(
    process.argv[3] || String(input.season || 2026),
    10
  );
  console.log(`\n🏀 Bracket Seeder — Season ${season}\n`);

  // Validate bracket structure
  const errors = validateBracketInput(input);
  if (errors.length > 0) {
    console.error("❌ Bracket validation failed:");
    for (const err of errors) {
      console.error(`   • ${err}`);
    }
    process.exit(1);
  }
  console.log("✅ Bracket structure validated (64 teams, 4 regions × 16 seeds).\n");

  // Connect to Supabase
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Match teams
  console.log("🔍 Matching team names to database...");
  const { matched, unmatched } = await matchTeams(supabase, input.teams, season);

  console.log(`   ✅ Matched: ${matched.size} / 64`);

  if (unmatched.length > 0) {
    console.error(`   ❌ Unmatched: ${unmatched.length}`);
    for (const name of unmatched) {
      console.error(`      • ${name}`);
    }
    console.error(
      "\n⚠️  Cannot proceed with unmatched teams. Please update the bracket JSON to"
    );
    console.error(
      "   use team names that match the database (teams.name, teams.short_name,"
    );
    console.error("   or team_name_mappings).");
    process.exit(1);
  }

  // Build entries
  const entries = input.teams.map((inputTeam) => {
    const match = matched.get(inputTeam.name)!;
    return {
      team_season_id: match.team_season_id,
      team_id: match.team_id,
      season,
      seed: inputTeam.seed,
      region: inputTeam.region as "East" | "West" | "South" | "Midwest",
      bracket_position: inputTeam.seed, // bracket_position == seed for standard bracket
    };
  });

  // Clear and insert
  console.log("\n🗑️  Clearing existing tournament entries...");
  const { error: deleteError } = await supabase
    .from("tournament_entries")
    .delete()
    .eq("season", season);

  if (deleteError) {
    console.error("❌ Failed to clear:", deleteError.message);
    process.exit(1);
  }

  console.log("💾 Inserting 64 tournament entries...\n");
  const { error: insertError } = await supabase
    .from("tournament_entries")
    .insert(entries);

  if (insertError) {
    console.error("❌ Failed to insert:", insertError.message);
    process.exit(1);
  }

  // Display bracket
  console.log("🏆 Official Bracket — Season " + season + ":\n");
  for (const region of VALID_REGIONS) {
    console.log(`  ── ${region} Region ──`);
    const regionTeams = input.teams
      .filter((t) => t.region === region)
      .sort((a, b) => a.seed - b.seed);

    for (const team of regionTeams) {
      console.log(`    ${String(team.seed).padStart(2)}. ${team.name}`);
    }
    console.log();
  }

  console.log("✅ Bracket seeded successfully! Visit /bracket to view.\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
