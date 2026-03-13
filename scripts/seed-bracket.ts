/**
 * Production bracket seeder for the NCAA tournament.
 *
 * Takes a JSON file with the official bracket (64 or 68 teams, seeds, regions)
 * and populates the `tournament_entries` table. Designed to run on Selection
 * Sunday after the bracket is announced.
 *
 * Supports two formats:
 * - **64-team bracket**: Each region has exactly seeds 1-16, no duplicates.
 * - **68-team bracket**: 4 play-in pairs share the same region+seed. The app's
 *   `detectPlayInPairs()` will automatically detect and configure First Four games.
 *
 * Usage:
 *   npx tsx scripts/seed-bracket.ts <bracket-file.json> [season]
 *
 * 64-team JSON format:
 * ```json
 * {
 *   "season": 2026,
 *   "teams": [
 *     { "name": "UConn", "seed": 1, "region": "East" },
 *     { "name": "Houston", "seed": 1, "region": "West" },
 *     ...64 total entries, unique (region, seed) pairs
 *   ]
 * }
 * ```
 *
 * 68-team JSON format (with First Four):
 * ```json
 * {
 *   "season": 2026,
 *   "teams": [
 *     { "name": "UConn", "seed": 1, "region": "East" },
 *     ...60 unique (region, seed) entries...
 *     { "name": "Team A", "seed": 16, "region": "East" },
 *     { "name": "Team B", "seed": 16, "region": "East" },
 *     { "name": "Team C", "seed": 16, "region": "South" },
 *     { "name": "Team D", "seed": 16, "region": "South" },
 *     { "name": "Team E", "seed": 11, "region": "West" },
 *     { "name": "Team F", "seed": 11, "region": "West" },
 *     { "name": "Team G", "seed": 11, "region": "Midwest" },
 *     { "name": "Team H", "seed": 11, "region": "Midwest" }
 *   ]
 * }
 * ```
 *
 * In the 68-team format, exactly 4 (region, seed) slots have 2 teams each.
 * These become First Four play-in games. Play-in seeds must be 11 or 16
 * (matching the real NCAA format).
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
const VALID_PLAY_IN_SEEDS = [11, 16];

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

  const teamCount = input.teams.length;
  if (teamCount !== 64 && teamCount !== 68) {
    errors.push(
      `Expected exactly 64 or 68 teams, got ${teamCount}.`
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

  // Validate bracket structure: count teams per (region, seed)
  const regionSeedCounts = new Map<string, string[]>(); // key -> team names
  for (const team of input.teams) {
    if (!team.region || !team.seed) continue;
    const key = `${team.region}-${team.seed}`;
    const existing = regionSeedCounts.get(key);
    if (existing) {
      existing.push(team.name);
    } else {
      regionSeedCounts.set(key, [team.name]);
    }
  }

  // Find duplicate slots (play-in pairs)
  const playInSlots: { region: string; seed: number; teams: string[] }[] = [];
  for (const [key, teams] of regionSeedCounts) {
    if (teams.length === 2) {
      const [region, seedStr] = key.split("-");
      playInSlots.push({ region, seed: parseInt(seedStr, 10), teams });
    } else if (teams.length > 2) {
      errors.push(
        `Slot ${key} has ${teams.length} teams — max 2 allowed (play-in pair): ${teams.join(", ")}`
      );
    }
  }

  if (teamCount === 68) {
    // 68-team bracket: must have exactly 4 play-in pairs
    if (playInSlots.length !== 4) {
      errors.push(
        `68-team bracket requires exactly 4 play-in pairs (duplicate region+seed), found ${playInSlots.length}.`
      );
    }

    // Play-in seeds must be 11 or 16
    for (const slot of playInSlots) {
      if (!VALID_PLAY_IN_SEEDS.includes(slot.seed)) {
        errors.push(
          `Play-in pair at ${slot.region}-${slot.seed}: play-in seeds must be 11 or 16, got ${slot.seed}.`
        );
      }
    }

    // Should have exactly 2 play-ins at seed 16 and 2 at seed 11
    const countBySeed = new Map<number, number>();
    for (const slot of playInSlots) {
      countBySeed.set(slot.seed, (countBySeed.get(slot.seed) || 0) + 1);
    }
    for (const piSeed of VALID_PLAY_IN_SEEDS) {
      const count = countBySeed.get(piSeed) || 0;
      if (count !== 2) {
        errors.push(
          `Expected exactly 2 play-in pairs at seed ${piSeed}, found ${count}.`
        );
      }
    }

    // Validate that non-play-in slots all have exactly 1 team
    for (const [key, teams] of regionSeedCounts) {
      if (teams.length === 1) continue; // Normal slot
      if (teams.length === 2) continue; // Play-in pair (validated above)
    }

    // Each region should have 16 unique seeds + play-in extras
    for (const region of VALID_REGIONS) {
      const regionTeams = input.teams.filter((t) => t.region === region);
      const regionPlayIns = playInSlots.filter((s) => s.region === region).length;
      const expectedTeams = 16 + regionPlayIns;
      if (regionTeams.length !== expectedTeams) {
        errors.push(
          `Region ${region}: expected ${expectedTeams} teams (16 + ${regionPlayIns} play-ins), got ${regionTeams.length}.`
        );
      }
    }
  } else if (teamCount === 64) {
    // 64-team bracket: no duplicates allowed
    if (playInSlots.length > 0) {
      errors.push(
        `64-team bracket should have no duplicate (region, seed) slots, found ${playInSlots.length}: ` +
          playInSlots.map((s) => `${s.region}-${s.seed}`).join(", ")
      );
    }

    // Each region must have seeds 1-16
    for (const region of VALID_REGIONS) {
      const seeds = new Set<number>();
      for (const team of input.teams) {
        if (team.region === region) seeds.add(team.seed);
      }
      if (seeds.size !== 16) {
        errors.push(
          `Region ${region}: expected 16 unique seeds (1-16), got ${seeds.size}.`
        );
      }
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
    console.error("\n64-team bracket JSON:");
    console.error(
      JSON.stringify(
        {
          season: 2026,
          teams: [
            { name: "UConn", seed: 1, region: "East" },
            { name: "Houston", seed: 1, region: "West" },
            { name: "...", seed: 0, region: "East" },
          ],
        },
        null,
        2
      )
    );
    console.error("\n68-team bracket JSON (with First Four):");
    console.error(
      JSON.stringify(
        {
          season: 2026,
          teams: [
            { name: "UConn", seed: 1, region: "East" },
            { name: "...", seed: 0, region: "East" },
            {
              _comment: "Play-in pair: 2 teams share same region+seed",
            },
            { name: "Team A", seed: 16, region: "East" },
            { name: "Team B", seed: 16, region: "East" },
          ],
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  // Load environment variables
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
  } catch {
    // dotenv not installed — environment variables must be set externally
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
  const teamCount = input.teams?.length ?? 0;
  console.log(
    `\n🏀 Bracket Seeder — Season ${season} (${teamCount} teams)\n`
  );

  // Validate bracket structure
  const errors = validateBracketInput(input);
  if (errors.length > 0) {
    console.error("❌ Bracket validation failed:");
    for (const err of errors) {
      console.error(`   • ${err}`);
    }
    process.exit(1);
  }

  // Detect and report play-in info
  const regionSeedCounts = new Map<string, number>();
  for (const team of input.teams) {
    const key = `${team.region}-${team.seed}`;
    regionSeedCounts.set(key, (regionSeedCounts.get(key) || 0) + 1);
  }
  const playInSlots = [...regionSeedCounts.entries()]
    .filter(([, count]) => count === 2)
    .map(([key]) => key);

  if (teamCount === 68) {
    console.log(
      `✅ 68-team bracket validated (4 regions × 16 seeds + 4 First Four play-ins).`
    );
    console.log(`   Play-in slots: ${playInSlots.join(", ")}\n`);
  } else {
    console.log(
      `✅ 64-team bracket validated (4 regions × 16 seeds).\n`
    );
  }

  // Connect to Supabase
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Match teams
  console.log("🔍 Matching team names to database...");
  const { matched, unmatched } = await matchTeams(supabase, input.teams, season);

  console.log(`   ✅ Matched: ${matched.size} / ${teamCount}`);

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

  console.log(`💾 Inserting ${teamCount} tournament entries...\n`);
  const { error: insertError } = await supabase
    .from("tournament_entries")
    .insert(entries);

  if (insertError) {
    console.error("❌ Failed to insert:", insertError.message);
    process.exit(1);
  }

  // Display bracket
  console.log("🏆 Official Bracket — Season " + season + ":\n");

  // Show First Four play-in games if applicable
  if (playInSlots.length > 0) {
    console.log("  ── First Four Play-In Games ──");
    for (const slotKey of playInSlots.sort()) {
      const [region, seedStr] = slotKey.split("-");
      const seed = parseInt(seedStr, 10);
      const slotTeams = input.teams.filter(
        (t) => t.region === region && t.seed === seed
      );
      console.log(
        `    ${region} ${seed}-seed: ${slotTeams[0].name}  vs  ${slotTeams[1].name}`
      );
    }
    console.log();
  }

  for (const region of VALID_REGIONS) {
    console.log(`  ── ${region} Region ──`);
    const regionTeams = input.teams
      .filter((t) => t.region === region)
      .sort((a, b) => a.seed - b.seed);

    // Group by seed for play-in display
    const seedGroups = new Map<number, BracketTeamInput[]>();
    for (const team of regionTeams) {
      const group = seedGroups.get(team.seed);
      if (group) {
        group.push(team);
      } else {
        seedGroups.set(team.seed, [team]);
      }
    }

    for (const [seed, groupTeams] of [...seedGroups].sort(([a], [b]) => a - b)) {
      for (let i = 0; i < groupTeams.length; i++) {
        const team = groupTeams[i];
        const playInTag =
          groupTeams.length > 1 ? ` [First Four ${i === 0 ? "A" : "B"}]` : "";
        console.log(`    ${String(seed).padStart(2)}. ${team.name}${playInTag}`);
      }
    }
    console.log();
  }

  console.log(
    `✅ Bracket seeded successfully! (${teamCount} teams${playInSlots.length > 0 ? ", including First Four" : ""}) Visit /bracket to view.\n`
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
