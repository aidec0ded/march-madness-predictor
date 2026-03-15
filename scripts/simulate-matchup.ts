/**
 * Standalone matchup simulation script.
 *
 * Usage: npx tsx scripts/simulate-matchup.ts "Texas" "Tennessee"
 *
 * Fetches both teams from Supabase and runs the full probability engine pipeline.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { transformTeamSeasonRows } from "../src/lib/supabase/transforms";
import type { TeamSeasonJoinedRow } from "../src/lib/supabase/transforms";
import type { TournamentEntryRow } from "../src/lib/supabase/types";
import type { TeamSeason } from "../src/types/team";
import { resolveMatchup } from "../src/lib/engine/matchup";
import { DEFAULT_ENGINE_CONFIG } from "../src/types/engine";
import { ratingDiffToSpread } from "../src/lib/engine/win-probability";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const teamAName = args[0] ?? "Texas";
const teamBName = args[1] ?? "Tennessee";
const season = 2026;

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Fetch all team seasons for the given season
  const { data: rows, error: tsError } = await supabase
    .from("team_seasons")
    .select("*, teams!inner(*), coaches(*)")
    .eq("season", season)
    .returns<TeamSeasonJoinedRow[]>();

  if (tsError || !rows) {
    console.error("Error fetching team_seasons:", tsError?.message);
    process.exit(1);
  }

  // 2. Fetch tournament entries
  const { data: entryRows } = await supabase
    .from("tournament_entries")
    .select("*")
    .eq("season", season)
    .returns<TournamentEntryRow[]>();

  // 3. Transform into TeamSeason objects
  const allTeams: TeamSeason[] = transformTeamSeasonRows(rows, entryRows ?? []);

  // 4. Find the two teams by name (exact match first, then partial)
  const findTeam = (name: string): TeamSeason | undefined => {
    const lower = name.toLowerCase();
    // Exact match on full name or short name
    const exact = allTeams.find(
      (t) =>
        t.team.name.toLowerCase() === lower ||
        t.team.shortName.toLowerCase() === lower
    );
    if (exact) return exact;
    // Partial match — prefer shortest name to avoid "Texas A&M Corpus Christi" matching "Texas"
    const partials = allTeams
      .filter((t) => t.team.name.toLowerCase().includes(lower))
      .sort((a, b) => a.team.name.length - b.team.name.length);
    return partials[0];
  };

  const teamA = findTeam(teamAName);
  const teamB = findTeam(teamBName);

  if (!teamA) {
    console.error(`Team not found: "${teamAName}"`);
    process.exit(1);
  }
  if (!teamB) {
    console.error(`Team not found: "${teamBName}"`);
    process.exit(1);
  }

  // 5. Run the engine
  const result = resolveMatchup(teamA, teamB, DEFAULT_ENGINE_CONFIG);
  const b = result.breakdown;

  // 6. Output
  const spread = ratingDiffToSpread(b.ratingDifferential + b.totalMeanAdjustment);
  const fmtAdj = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(3);
  const fmtPct = (v: number) => (v * 100).toFixed(1) + "%";

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`MATCHUP: ${teamA.team.name} vs ${teamB.team.name}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Seeds
  const seedA = teamA.tournamentEntry?.seed ?? "N/A";
  const seedB = teamB.tournamentEntry?.seed ?? "N/A";
  console.log(`SEEDS: ${teamA.team.shortName} (${seedA}) vs ${teamB.team.shortName} (${seedB})\n`);

  // Win probability
  console.log("WIN PROBABILITY");
  console.log(`  ${teamA.team.shortName}: ${fmtPct(result.winProbabilityA)}  |  ${teamB.team.shortName}: ${fmtPct(result.winProbabilityB)}`);
  console.log(`  Spread: ${spread < 0 ? teamA.team.shortName : teamB.team.shortName} by ${Math.abs(spread).toFixed(1)}\n`);

  // Composite ratings
  console.log("COMPOSITE RATINGS");
  console.log(`  ${teamA.team.shortName}: AdjEM ${b.compositeRatingA.adjEM >= 0 ? "+" : ""}${b.compositeRatingA.adjEM.toFixed(2)} (OE ${b.compositeRatingA.adjOE.toFixed(1)}, DE ${b.compositeRatingA.adjDE.toFixed(1)})`);
  console.log(`    Sources: ${b.compositeRatingA.sources.map(s => `${s.source} ${s.adjEM >= 0 ? "+" : ""}${s.adjEM.toFixed(1)} (${(s.weight * 100).toFixed(0)}%)`).join(" | ")}`);
  console.log(`  ${teamB.team.shortName}: AdjEM ${b.compositeRatingB.adjEM >= 0 ? "+" : ""}${b.compositeRatingB.adjEM.toFixed(2)} (OE ${b.compositeRatingB.adjOE.toFixed(1)}, DE ${b.compositeRatingB.adjDE.toFixed(1)})`);
  console.log(`    Sources: ${b.compositeRatingB.sources.map(s => `${s.source} ${s.adjEM >= 0 ? "+" : ""}${s.adjEM.toFixed(1)} (${(s.weight * 100).toFixed(0)}%)`).join(" | ")}\n`);

  // Probability breakdown
  console.log("PROBABILITY BREAKDOWN");
  console.log(`  Base (from rating diff):       ${fmtPct(b.baseProbability)}`);
  console.log(`  Rating differential:           ${fmtAdj(b.ratingDifferential)}`);
  console.log(`  Four Factors adjustment:       ${fmtAdj(b.fourFactorsAdjustment)}`);
  console.log(`  Experience adjustment:         ${fmtAdj(b.experienceAdjustment)}`);
  console.log(`  Continuity adjustment:         ${fmtAdj(b.continuityAdjustment)}`);
  console.log(`  Coach adjustment:              ${fmtAdj(b.coachAdjustment)}`);
  console.log(`  Opponent adjust (Miya):        ${fmtAdj(b.opponentAdjustAdjustment)}`);
  console.log(`  Bench depth adjustment:        ${fmtAdj(b.benchDepthAdjustment)}`);
  console.log(`  Pace adjust (Miya):            ${fmtAdj(b.paceAdjustAdjustment)}`);
  console.log(`  Site proximity adjustment:     ${fmtAdj(b.siteProximityAdjustment)}`);
  console.log(`  SOS adjustment:                ${fmtAdj(b.sosAdjustment)}`);
  console.log(`  Luck regression adjustment:    ${fmtAdj(b.luckRegressionAdjustment)}`);
  console.log(`  Total mean adjustment:         ${fmtAdj(b.totalMeanAdjustment)}`);
  console.log(`  Tempo variance multiplier:     ${b.tempoVarianceMultiplier.toFixed(3)}x`);
  console.log(`  3PT variance multiplier:       ${b.threePtVarianceMultiplier.toFixed(3)}x`);
  console.log(`  Combined variance:             ${b.combinedVarianceMultiplier.toFixed(3)}x`);
  console.log(`  Final probability (${teamA.team.shortName}):  ${fmtPct(b.finalProbability)}\n`);

  // Key stats comparison
  console.log("KEY STATS COMPARISON");
  console.log(`  ${"Stat".padEnd(22)} ${teamA.team.shortName.padEnd(10)} ${teamB.team.shortName.padEnd(10)} Edge`);
  console.log(`  ${"─".repeat(52)}`);

  // Stats are stored as raw percentages (49.2 = 49.2%), not decimals
  const statRows: [string, number, number, string][] = [
    ["eFG% (Off)", teamA.fourFactorsOffense.efgPct, teamB.fourFactorsOffense.efgPct, "pct"],
    ["eFG% (Def)", teamA.fourFactorsDefense.efgPct, teamB.fourFactorsDefense.efgPct, "pct inv"],
    ["TO% (Off)", teamA.fourFactorsOffense.toPct, teamB.fourFactorsOffense.toPct, "pct inv"],
    ["TO% (Def)", teamA.fourFactorsDefense.toPct, teamB.fourFactorsDefense.toPct, "pct"],
    ["ORB% (Off)", teamA.fourFactorsOffense.orbPct, teamB.fourFactorsOffense.orbPct, "pct"],
    ["ORB% (Def)", teamA.fourFactorsDefense.orbPct, teamB.fourFactorsDefense.orbPct, "pct inv"],
    ["FT Rate (Off)", teamA.fourFactorsOffense.ftRate, teamB.fourFactorsOffense.ftRate, "pct"],
    ["FT Rate (Def)", teamA.fourFactorsDefense.ftRate, teamB.fourFactorsDefense.ftRate, "pct inv"],
    ["Adj Tempo", teamA.adjTempo, teamB.adjTempo, "n"],
    ["Experience", teamA.experience, teamB.experience, "n"],
    ["Mins Continuity", teamA.minutesContinuity ?? 0, teamB.minutesContinuity ?? 0, "pct"],
    ["3PT Rate (Off)", teamA.shootingOffense.threePtRate, teamB.shootingOffense.threePtRate, "pct"],
    ["3PT% (Off)", teamA.shootingOffense.threePtPct, teamB.shootingOffense.threePtPct, "pct"],
    ["FT% (Off)", teamA.shootingOffense.ftPct, teamB.shootingOffense.ftPct, "pct"],
    ["Avg Height", teamA.avgHeight, teamB.avgHeight, "n"],
    ["Bench Min %", teamA.benchMinutesPct, teamB.benchMinutesPct, "pct"],
    ["2-Foul Part", teamA.twoFoulParticipation, teamB.twoFoulParticipation, "pct"],
  ];

  for (const [label, a, b2, fmt] of statRows) {
    const isInverse = fmt.includes("inv");
    const fmtVal = (v: number) => {
      if (fmt.includes("pct")) return v.toFixed(1) + "%";
      return v.toFixed(1);
    };

    let edge = "";
    const diff = a - b2;
    if (Math.abs(diff) > 0.001) {
      if (isInverse) {
        edge = diff < 0 ? `→${teamA.team.shortName}` : `→${teamB.team.shortName}`;
      } else {
        edge = diff > 0 ? `→${teamA.team.shortName}` : `→${teamB.team.shortName}`;
      }
    }

    console.log(`  ${label.padEnd(22)} ${fmtVal(a).padEnd(10)} ${fmtVal(b2).padEnd(10)} ${edge}`);
  }

  // Coach comparison
  console.log(`\nCOACH COMPARISON`);
  const cA = teamA.coach;
  const cB = teamB.coach;
  console.log(`  ${teamA.team.shortName}: ${cA.name} — ${cA.tournamentGames}G, ${cA.tournamentWins}W, ${cA.finalFours} F4, ${cA.championships} Champ`);
  console.log(`  ${teamB.team.shortName}: ${cB.name} — ${cB.tournamentGames}G, ${cB.tournamentWins}W, ${cB.finalFours} F4, ${cB.championships} Champ`);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
