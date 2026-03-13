#!/usr/bin/env npx tsx
/**
 * Coach Data Seeder — derives coach tournament records from Kaggle data.
 *
 * Reads three CSV files from the Kaggle March Machine Learning Mania dataset:
 *   - MTeamCoaches.csv       (coach → team → season mapping)
 *   - MNCAATourneyCompactResults.csv  (every tournament game result)
 *   - MNCAATourneySlots.csv   (bracket structure with round identifiers)
 *   - MTeams.csv              (TeamID → team name mapping)
 *
 * Derives cumulative coach tournament stats as-of each season:
 *   - Tournament games & wins
 *   - Final Four appearances
 *   - Championships
 *   - Years as D-1 head coach
 *
 * Outputs:
 *   - JSON file with per-coach-per-season snapshots
 *   - Optionally seeds coaches into Supabase for a given season
 *
 * Usage:
 *   npx tsx scripts/seed-coaches.ts                              # Generate JSON only
 *   npx tsx scripts/seed-coaches.ts --seed --season 2026         # Seed single season
 *   npx tsx scripts/seed-coaches.ts --seed --season 2026 --dry-run  # Preview
 *   npx tsx scripts/seed-coaches.ts --seed --all-seasons         # Seed all seasons (2002-2026)
 *
 * @module
 */

import * as fs from "fs";
import * as path from "path";
import { normalizeForMerge } from "../src/lib/data/merger";

// ---------------------------------------------------------------------------
// Kaggle-specific name overrides
// ---------------------------------------------------------------------------

/**
 * Maps Kaggle team names that use unique abbreviations not shared by
 * Torvik/KenPom/Evan Miya to their canonical DB names. These are only
 * needed for names that `normalizeForMerge()` cannot resolve.
 *
 * Keys are lowercase Kaggle names; values are the DB canonical names
 * (which will also be run through `normalizeForMerge()` for lookup).
 */
const KAGGLE_NAME_OVERRIDES: Record<string, string> = {
  "abilene chr": "Abilene Christian",
  "suny albany": "Albany",
  "american univ": "American",
  "ark little rock": "Little Rock",
  "ark pine bluff": "Arkansas-Pine Bluff",
  "boston univ": "Boston University",
  "c michigan": "Central Michigan",
  "cent arkansas": "Central Arkansas",
  "central conn": "Central Connecticut",
  "charleston so": "Charleston Southern",
  "citadel": "The Citadel",
  "coastal car": "Coastal Carolina",
  "col charleston": "Charleston",
  "cs bakersfield": "Cal State Bakersfield",
  "cs fullerton": "Cal State Fullerton",
  "cs northridge": "Cal State Northridge",
  "cs sacramento": "Sacramento State",
  "e illinois": "Eastern Illinois",
  "e kentucky": "Eastern Kentucky",
  "e michigan": "Eastern Michigan",
  "e washington": "Eastern Washington",
  "f dickinson": "Fairleigh Dickinson",
  "ga southern": "Georgia Southern",
  "geo washington": "George Washington",
  "green bay": "Green Bay",
  "il chicago": "Illinois-Chicago",
  "iupui": "IUPUI",
  "kent": "Kent State",
  "liu brooklyn": "LIU",
  "loyola il": "Loyola Chicago",
  "loyola md": "Loyola MD",
  "loyola marymount": "Loyola Marymount",
  "md baltimore county": "UMBC",
  "md eastern shore": "Maryland-Eastern Shore",
  "miami fl": "Miami FL",
  "miami oh": "Miami OH",
  "mil": "Milwaukee",
  "miss valley st": "Mississippi Valley State",
  "n colorado": "Northern Colorado",
  "n illinois": "Northern Illinois",
  "n kentucky": "Northern Kentucky",
  "nw state": "Northwestern State",
  "prairie view": "Prairie View A&M",
  "s carolina st": "South Carolina State",
  "s illinois": "Southern Illinois",
  "se louisiana": "Southeastern Louisiana",
  "se missouri st": "Southeast Missouri State",
  "siue": "SIU Edwardsville",
  "southern miss": "Southern Miss",
  "st francis ny": "St. Francis NY",
  "st francis pa": "St. Francis PA",
  "st josephs pa": "Saint Joseph's",
  "st marys ca": "Saint Mary's",
  "st thomas mn": "St. Thomas",
  "tenn martin": "UT Martin",
  "texas a&m cc": "Texas A&M-Corpus Christi",
  "texas st": "Texas State",
  "tx southern": "Texas Southern",
  "uc riverside": "UC Riverside",
  "unc asheville": "UNC Asheville",
  "unc greensboro": "UNC Greensboro",
  "unc wilmington": "UNC Wilmington",
  "ut arlington": "UT Arlington",
  "w carolina": "Western Carolina",
  "w illinois": "Western Illinois",
  "w kentucky": "Western Kentucky",
  "w michigan": "Western Michigan",
  "wis green bay": "Green Bay",
  "wis milwaukee": "Milwaukee",
  "wku": "Western Kentucky",
  // Additional Kaggle abbreviations for common tournament teams
  "col charleston": "Charleston",
  "fl atlantic": "Florida Atlantic",
  "florida intl": "Florida International",
  "g washington": "George Washington",
  "houston chr": "Houston Christian",
  "pfw": "Purdue Fort Wayne",
  "kennesaw": "Kennesaw State",
  "loy marymount": "Loyola Marymount",
  "loyola-chicago": "Loyola Chicago",
  "ma lowell": "UMass Lowell",
  "md e shore": "Maryland-Eastern Shore",
  "missouri kc": "UMKC",
  "monmouth nj": "Monmouth",
  "ne omaha": "Nebraska Omaha",
  "northwestern la": "Northwestern State",
  "sf austin": "Stephen F. Austin",
  "southern univ": "Southern",
  "tam c. christi": "Texas A&M-Corpus Christi",
  "tx southern": "Texas Southern",
  "st thomas mn": "St. Thomas",
  "n arizona": "Northern Arizona",
  "n colorado": "Northern Colorado",
  "w virginia": "West Virginia",
  "robert morris": "Robert Morris",
  "se missouri st": "Southeast Missouri State",
  "tn martin": "Tennessee-Martin",
  "tenn martin": "Tennessee-Martin",
  "utrgv": "UT Rio Grande Valley",
  "ulm": "Louisiana-Monroe",
  "ut san antonio": "UTSA",
  "wi green bay": "Green Bay",
  "wi milwaukee": "Milwaukee",
  "queens nc": "Queens",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoachAssignment {
  season: number;
  teamId: number;
  firstDayNum: number;
  lastDayNum: number;
  coachName: string;
}

interface TourneyGame {
  season: number;
  dayNum: number;
  winTeamId: number;
  winScore: number;
  loseTeamId: number;
  loseScore: number;
}

interface TourneySlot {
  season: number;
  slot: string;
  strongSeed: string;
  weakSeed: string;
}

interface KaggleTeam {
  teamId: number;
  teamName: string;
}

/** Cumulative coach record as-of a specific season */
interface CoachSeasonSnapshot {
  coachName: string;
  displayName: string;
  season: number;
  teamId: number;
  teamName: string;
  tournamentGames: number;
  tournamentWins: number;
  finalFours: number;
  championships: number;
  yearsHeadCoach: number;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function readCsv(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((l) => l.split(",").map((c) => c.trim()));
}

function parseCoaches(dataDir: string): CoachAssignment[] {
  const rows = readCsv(path.join(dataDir, "MTeamCoaches.csv"));
  return rows.slice(1).map((r) => ({
    season: parseInt(r[0]),
    teamId: parseInt(r[1]),
    firstDayNum: parseInt(r[2]),
    lastDayNum: parseInt(r[3]),
    coachName: r[4],
  }));
}

function parseTourneyResults(dataDir: string): TourneyGame[] {
  const rows = readCsv(path.join(dataDir, "MNCAATourneyCompactResults.csv"));
  return rows.slice(1).map((r) => ({
    season: parseInt(r[0]),
    dayNum: parseInt(r[1]),
    winTeamId: parseInt(r[2]),
    winScore: parseInt(r[3]),
    loseTeamId: parseInt(r[4]),
    loseScore: parseInt(r[5]),
  }));
}

function parseTourneySlots(dataDir: string): TourneySlot[] {
  const rows = readCsv(path.join(dataDir, "MNCAATourneySlots.csv"));
  return rows.slice(1).map((r) => ({
    season: parseInt(r[0]),
    slot: r[1],
    strongSeed: r[2],
    weakSeed: r[3],
  }));
}

function parseTeams(dataDir: string): KaggleTeam[] {
  const rows = readCsv(path.join(dataDir, "MTeams.csv"));
  return rows.slice(1).map((r) => ({
    teamId: parseInt(r[0]),
    teamName: r[1],
  }));
}

// ---------------------------------------------------------------------------
// Coach name formatting
// ---------------------------------------------------------------------------

/**
 * Convert underscore-separated lowercase name to proper display name.
 * "tom_izzo" → "Tom Izzo"
 * "billy_bob_jr" → "Billy Bob Jr"
 */
function formatCoachName(raw: string): string {
  return raw
    .split("_")
    .map((part) => {
      if (part.length === 0) return "";
      // Handle suffixes
      if (part === "jr" || part === "sr") return part.charAt(0).toUpperCase() + part.slice(1) + ".";
      if (part === "ii" || part === "iii" || part === "iv") return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Round identification from tournament slots
// ---------------------------------------------------------------------------

/**
 * Build a mapping of (season, teamId) participation in Final Four and Championship games.
 *
 * Strategy: trace the bracket tree from slots to identify which games are
 * Final Four (R5) and Championship (R6). Then match game results to those slots
 * by traversing the bracket.
 */
function buildRoundMap(
  slots: TourneySlot[],
  games: TourneyGame[]
): {
  finalFourTeams: Map<string, Set<number>>; // "season" → set of teamIds
  championTeams: Map<string, number>; // "season" → winning teamId
} {
  const finalFourTeams = new Map<string, Set<number>>();
  const championTeams = new Map<string, number>();

  // Group games by season for efficient lookup
  const gamesBySeason = new Map<number, TourneyGame[]>();
  for (const g of games) {
    if (!gamesBySeason.has(g.season)) gamesBySeason.set(g.season, []);
    gamesBySeason.get(g.season)!.push(g);
  }

  // Group slots by season
  const slotsBySeason = new Map<number, TourneySlot[]>();
  for (const s of slots) {
    if (!slotsBySeason.has(s.season)) slotsBySeason.set(s.season, []);
    slotsBySeason.get(s.season)!.push(s);
  }

  for (const [season, seasonSlots] of slotsBySeason) {
    const seasonGames = gamesBySeason.get(season) ?? [];
    if (seasonGames.length === 0) continue;

    // Sort games by DayNum to identify rounds by order
    const sortedGames = [...seasonGames].sort((a, b) => a.dayNum - b.dayNum);

    // The championship game is the last game of the season
    const champGame = sortedGames[sortedGames.length - 1];
    championTeams.set(String(season), champGame.winTeamId);

    // Final Four = the 4 teams that played in the last 3 games
    // (2 semifinal games + 1 championship game)
    const ffTeams = new Set<number>();
    const last3 = sortedGames.slice(-3);
    for (const g of last3) {
      ffTeams.add(g.winTeamId);
      ffTeams.add(g.loseTeamId);
    }
    // But if there are only 2 Final Four games + 1 championship = 3 games at the end
    // The Final Four teams are those in the last 3 games
    finalFourTeams.set(String(season), ffTeams);
  }

  return { finalFourTeams, championTeams };
}

// ---------------------------------------------------------------------------
// Coach stats derivation
// ---------------------------------------------------------------------------

function deriveCoachStats(
  coaches: CoachAssignment[],
  games: TourneyGame[],
  slots: TourneySlot[],
  teams: KaggleTeam[],
  minSeason: number = 1985
): CoachSeasonSnapshot[] {
  // Build team name map
  const teamNameMap = new Map<number, string>();
  for (const t of teams) {
    teamNameMap.set(t.teamId, t.teamName);
  }

  // Build round identification
  const { finalFourTeams, championTeams } = buildRoundMap(slots, games);

  // Group coaches by season for tournament-time matching
  const coachesBySeason = new Map<number, CoachAssignment[]>();
  for (const c of coaches) {
    if (!coachesBySeason.has(c.season)) coachesBySeason.set(c.season, []);
    coachesBySeason.get(c.season)!.push(c);
  }

  // Track cumulative stats per coach
  const cumulativeGames = new Map<string, number>();
  const cumulativeWins = new Map<string, number>();
  const cumulativeFinalFours = new Map<string, number>();
  const cumulativeChampionships = new Map<string, number>();

  // Track first year as head coach (for yearsHeadCoach calculation)
  const firstYearAsCoach = new Map<string, number>();
  for (const c of coaches) {
    const existing = firstYearAsCoach.get(c.coachName);
    if (existing === undefined || c.season < existing) {
      firstYearAsCoach.set(c.coachName, c.season);
    }
  }

  // Group games by season
  const gamesBySeason = new Map<number, TourneyGame[]>();
  for (const g of games) {
    if (!gamesBySeason.has(g.season)) gamesBySeason.set(g.season, []);
    gamesBySeason.get(g.season)!.push(g);
  }

  // Get all unique seasons and sort
  const allSeasons = [...new Set(coaches.map((c) => c.season))].sort((a, b) => a - b);

  // For each season, compute the cumulative stats for each coach through that season
  const snapshots: CoachSeasonSnapshot[] = [];

  for (const season of allSeasons) {
    const seasonGames = gamesBySeason.get(season) ?? [];
    const seasonCoaches = coachesBySeason.get(season) ?? [];

    // Find which coach was coaching each team during the tournament
    // Tournament games typically have DayNum >= 134
    for (const game of seasonGames) {
      // Find coach for winning team
      const winCoach = seasonCoaches.find(
        (c) =>
          c.teamId === game.winTeamId &&
          game.dayNum >= c.firstDayNum &&
          game.dayNum <= c.lastDayNum
      );

      // Find coach for losing team
      const loseCoach = seasonCoaches.find(
        (c) =>
          c.teamId === game.loseTeamId &&
          game.dayNum >= c.firstDayNum &&
          game.dayNum <= c.lastDayNum
      );

      if (winCoach) {
        cumulativeGames.set(
          winCoach.coachName,
          (cumulativeGames.get(winCoach.coachName) ?? 0) + 1
        );
        cumulativeWins.set(
          winCoach.coachName,
          (cumulativeWins.get(winCoach.coachName) ?? 0) + 1
        );
      }

      if (loseCoach) {
        cumulativeGames.set(
          loseCoach.coachName,
          (cumulativeGames.get(loseCoach.coachName) ?? 0) + 1
        );
      }
    }

    // Final Four appearances for this season
    const ffTeams = finalFourTeams.get(String(season));
    if (ffTeams) {
      const ffCoachesThisSeason = new Set<string>();
      for (const teamId of ffTeams) {
        const coach = seasonCoaches.find(
          (c) => c.teamId === teamId && c.lastDayNum >= 134
        );
        if (coach && !ffCoachesThisSeason.has(coach.coachName)) {
          ffCoachesThisSeason.add(coach.coachName);
          cumulativeFinalFours.set(
            coach.coachName,
            (cumulativeFinalFours.get(coach.coachName) ?? 0) + 1
          );
        }
      }
    }

    // Championship
    const champTeamId = championTeams.get(String(season));
    if (champTeamId !== undefined) {
      const champCoach = seasonCoaches.find(
        (c) => c.teamId === champTeamId && c.lastDayNum >= 134
      );
      if (champCoach) {
        cumulativeChampionships.set(
          champCoach.coachName,
          (cumulativeChampionships.get(champCoach.coachName) ?? 0) + 1
        );
      }
    }

    // Only create snapshots for seasons at or after minSeason
    // (cumulative stats are still tracked for all seasons above)
    if (season < minSeason) continue;

    // Create snapshots for coaches active THIS season
    for (const ca of seasonCoaches) {
      // Only create snapshot if coach has the end-of-season entry (lastDayNum >= 134 or is last entry)
      if (ca.lastDayNum < 100) continue; // Skip mid-season coaching changes

      const coachName = ca.coachName;
      const firstYear = firstYearAsCoach.get(coachName) ?? season;
      const yearsHC = season - firstYear + 1;

      snapshots.push({
        coachName,
        displayName: formatCoachName(coachName),
        season,
        teamId: ca.teamId,
        teamName: teamNameMap.get(ca.teamId) ?? `Unknown(${ca.teamId})`,
        tournamentGames: cumulativeGames.get(coachName) ?? 0,
        tournamentWins: cumulativeWins.get(coachName) ?? 0,
        finalFours: cumulativeFinalFours.get(coachName) ?? 0,
        championships: cumulativeChampionships.get(coachName) ?? 0,
        yearsHeadCoach: yearsHC,
      });
    }
  }

  return snapshots;
}

// ---------------------------------------------------------------------------
// Supabase seeding
// ---------------------------------------------------------------------------

async function seedToSupabase(
  snapshots: CoachSeasonSnapshot[],
  season: number,
  dryRun: boolean
) {
  // Dynamic import to avoid requiring Supabase deps when just generating JSON
  const { createClient } = await import("@supabase/supabase-js");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Filter to the requested season
  const seasonSnapshots = snapshots.filter((s) => s.season === season);
  console.log(`\nFound ${seasonSnapshots.length} coaches for season ${season}`);

  // We need to match Kaggle team names to our DB teams
  const { data: dbTeams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, short_name");

  if (teamsError) {
    console.error("Failed to fetch teams:", teamsError.message);
    process.exit(1);
  }

  // Also get name mappings for alternate spellings
  const { data: nameMappings } = await supabase
    .from("team_name_mappings")
    .select("team_id, kenpom_name, torvik_name, evanmiya_name");

  // Build lookup map (normalized name → team_id)
  // Uses normalizeForMerge() to handle abbreviation differences between
  // Kaggle team names (e.g., "Michigan St") and DB names (e.g., "Michigan St.").
  const teamLookup = new Map<string, string>();
  for (const t of dbTeams ?? []) {
    teamLookup.set(normalizeForMerge(t.name), t.id);
    if (t.short_name) teamLookup.set(normalizeForMerge(t.short_name), t.id);
  }
  for (const m of nameMappings ?? []) {
    if (m.kenpom_name) teamLookup.set(normalizeForMerge(m.kenpom_name), m.team_id);
    if (m.torvik_name) teamLookup.set(normalizeForMerge(m.torvik_name), m.team_id);
    if (m.evanmiya_name) teamLookup.set(normalizeForMerge(m.evanmiya_name), m.team_id);
  }

  // Get team_seasons for matching
  const { data: teamSeasons, error: tsError } = await supabase
    .from("team_seasons")
    .select("id, team_id, coach_id")
    .eq("season", season);

  if (tsError) {
    console.error("Failed to fetch team_seasons:", tsError.message);
    process.exit(1);
  }

  const tsMap = new Map<string, { id: string; coachId: string | null }>();
  for (const ts of teamSeasons ?? []) {
    tsMap.set(ts.team_id, { id: ts.id, coachId: ts.coach_id });
  }

  // Process each coach snapshot
  let matched = 0;
  let unmatched = 0;
  let seeded = 0;
  const unmatchedTeams: string[] = [];

  for (const snap of seasonSnapshots) {
    // Try to match Kaggle team name to our DB via normalized name.
    // First check the Kaggle-specific override table (stripping apostrophes
    // and lowercasing to match override keys), then fall back to direct
    // normalization of the Kaggle name.
    const kaggleKey = snap.teamName.toLowerCase().replace(/'/g, "");
    const overrideName = KAGGLE_NAME_OVERRIDES[kaggleKey];
    const lookupKey = overrideName
      ? normalizeForMerge(overrideName)
      : normalizeForMerge(snap.teamName);
    const dbTeamId = teamLookup.get(lookupKey);

    if (!dbTeamId) {
      unmatched++;
      unmatchedTeams.push(`${snap.teamName} (coach: ${snap.displayName})`);
      continue;
    }

    const ts = tsMap.get(dbTeamId);
    if (!ts) {
      // Team exists but no team_season for this year — skip
      continue;
    }

    matched++;

    if (dryRun) {
      console.log(
        `  [DRY RUN] ${snap.displayName} → ${snap.teamName} | ` +
        `Games: ${snap.tournamentGames}, Wins: ${snap.tournamentWins}, ` +
        `FF: ${snap.finalFours}, Champs: ${snap.championships}, ` +
        `Years: ${snap.yearsHeadCoach}`
      );
      continue;
    }

    // Upsert coach record
    const { data: coachData, error: coachError } = await supabase
      .from("coaches")
      .upsert(
        {
          name: snap.displayName,
          tournament_games: snap.tournamentGames,
          tournament_wins: snap.tournamentWins,
          final_fours: snap.finalFours,
          championships: snap.championships,
          years_head_coach: snap.yearsHeadCoach,
        },
        { onConflict: "name" }
      )
      .select("id")
      .single();

    if (coachError) {
      console.error(`  Failed to upsert coach ${snap.displayName}:`, coachError.message);
      continue;
    }

    // Link coach to team_season
    if (coachData) {
      const { error: linkError } = await supabase
        .from("team_seasons")
        .update({ coach_id: coachData.id })
        .eq("id", ts.id);

      if (linkError) {
        console.error(`  Failed to link coach to team_season:`, linkError.message);
      } else {
        seeded++;
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Matched to DB teams: ${matched}`);
  console.log(`  Seeded to Supabase: ${seeded}`);
  if (unmatchedTeams.length > 0) {
    console.log(`  Unmatched teams (${unmatched}):`);
    for (const t of unmatchedTeams.slice(0, 20)) {
      console.log(`    - ${t}`);
    }
    if (unmatchedTeams.length > 20) {
      console.log(`    ... and ${unmatchedTeams.length - 20} more`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sanity checks
// ---------------------------------------------------------------------------

function runSanityChecks(snapshots: CoachSeasonSnapshot[]) {
  console.log("\n--- Sanity Checks ---");

  // Check Tom Izzo (well-known: 8 Final Fours, 1 Championship as of 2025)
  const izzo2025 = snapshots.find(
    (s) => s.coachName === "tom_izzo" && s.season === 2025
  );
  if (izzo2025) {
    console.log(
      `Tom Izzo (2025): ${izzo2025.tournamentGames}G, ${izzo2025.tournamentWins}W, ` +
      `${izzo2025.finalFours}FF, ${izzo2025.championships}CH, ${izzo2025.yearsHeadCoach}yr`
    );
    // Izzo started at MSU in 1996, so 2025 - 1996 + 1 = 30 years
    // He's made 8 Final Fours (1999, 2000, 2001, 2005, 2009, 2010, 2015, 2019) — but in the
    // Kaggle data the first available year is 1985, and Izzo started in 1996
  }

  // Check recent champion
  const florida2025 = snapshots.find(
    (s) => s.teamName === "Florida" && s.season === 2025
  );
  if (florida2025) {
    console.log(
      `Florida coach (2025): ${florida2025.displayName} — ` +
      `${florida2025.tournamentGames}G, ${florida2025.tournamentWins}W, ` +
      `${florida2025.finalFours}FF, ${florida2025.championships}CH`
    );
  }

  // Check a recent 2026 coach
  const duke2026 = snapshots.find(
    (s) => s.teamName === "Duke" && s.season === 2026
  );
  if (duke2026) {
    console.log(
      `Duke coach (2026): ${duke2026.displayName} — ` +
      `${duke2026.tournamentGames}G, ${duke2026.tournamentWins}W, ` +
      `${duke2026.finalFours}FF, ${duke2026.championships}CH`
    );
  }

  // Summary stats
  const seasons = [...new Set(snapshots.map((s) => s.season))];
  console.log(`\nTotal snapshots: ${snapshots.length}`);
  console.log(`Seasons covered: ${Math.min(...seasons)} – ${Math.max(...seasons)}`);
  console.log(`Unique coaches: ${new Set(snapshots.map((s) => s.coachName)).size}`);

  // Coaches with most tournament wins (as of their latest snapshot)
  const latestByCoach = new Map<string, CoachSeasonSnapshot>();
  for (const s of snapshots) {
    const existing = latestByCoach.get(s.coachName);
    if (!existing || s.season > existing.season) {
      latestByCoach.set(s.coachName, s);
    }
  }
  const topCoaches = [...latestByCoach.values()]
    .sort((a, b) => b.tournamentWins - a.tournamentWins)
    .slice(0, 10);

  console.log("\nTop 10 coaches by tournament wins:");
  for (const c of topCoaches) {
    console.log(
      `  ${c.displayName}: ${c.tournamentWins}W/${c.tournamentGames}G, ` +
      `${c.finalFours}FF, ${c.championships}CH`
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load environment variables from .env.local if dotenv is available
  try {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
  } catch {
    // dotenv not installed — environment variables must be set externally
  }

  const args = process.argv.slice(2);
  const doSeed = args.includes("--seed");
  const dryRun = args.includes("--dry-run");
  const allSeasons = args.includes("--all-seasons");
  const seasonArg = args.find((a, i) => args[i - 1] === "--season");
  const season = seasonArg ? parseInt(seasonArg) : 2026;
  const minSeasonArg = args.find((a, i) => args[i - 1] === "--min-season");
  const minSeason = minSeasonArg ? parseInt(minSeasonArg) : 2002;

  const dataDir = path.join(
    __dirname,
    "..",
    "march-machine-learning-mania-2026"
  );

  if (!fs.existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`);
    console.error("Download the Kaggle March Machine Learning Mania 2026 dataset first.");
    process.exit(1);
  }

  console.log("Loading Kaggle data...");
  const coaches = parseCoaches(dataDir);
  const games = parseTourneyResults(dataDir);
  const slots = parseTourneySlots(dataDir);
  const teams = parseTeams(dataDir);

  console.log(`  Coaches: ${coaches.length} assignments`);
  console.log(`  Tournament games: ${games.length}`);
  console.log(`  Tournament slots: ${slots.length}`);
  console.log(`  Teams: ${teams.length}`);

  console.log(`\nDeriving coach stats (min season: ${minSeason})...`);
  const snapshots = deriveCoachStats(coaches, games, slots, teams, minSeason);

  // Run sanity checks
  runSanityChecks(snapshots);

  // Write JSON output
  const outPath = path.join(__dirname, "..", "data", "coach-snapshots.json");
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(snapshots, null, 2));
  console.log(`\nWrote ${snapshots.length} snapshots to ${outPath}`);

  // Optionally seed to Supabase
  if (doSeed) {
    if (allSeasons) {
      // Seed all seasons that have snapshots and team_seasons in the DB
      const uniqueSeasons = [...new Set(snapshots.map((s) => s.season))].sort();
      console.log(`\nSeeding coaches for ALL ${uniqueSeasons.length} seasons${dryRun ? " (DRY RUN)" : ""}...`);
      for (const s of uniqueSeasons) {
        console.log(`\n${"=".repeat(40)}`);
        console.log(`  Season ${s}`);
        console.log("=".repeat(40));
        await seedToSupabase(snapshots, s, dryRun);
      }
    } else {
      console.log(`\nSeeding to Supabase for season ${season}${dryRun ? " (DRY RUN)" : ""}...`);
      await seedToSupabase(snapshots, season, dryRun);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
