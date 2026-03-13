/**
 * Scrapes historical NCAA tournament results from sports-reference.com
 * and generates a static TypeScript data file.
 *
 * Usage:
 *   npx tsx scripts/scrape-tournament-results.ts
 *
 * Output:
 *   src/lib/backtest/historical-results.ts
 *
 * Covers seasons 2008–2024, excluding 2020 (cancelled due to COVID).
 * Each season has 63 games (First Four play-in games are excluded).
 *
 * Rate-limited to avoid overloading the source server (5 seconds between requests).
 *
 * Page structure (sports-reference.com bracket pages):
 * - Page has regional sections: #east, #midwest, #south, #west, #national
 * - Each region has a bracket element (class="team16" for regions, "team4" for national)
 * - Each bracket has .round divs (columns)
 *   - Region brackets: 5 rounds → R64(8), R32(4), S16(2), E8(1), empty
 *   - National bracket: 3 rounds → F4(2), NCG(1), empty
 * - Each game is a div with 2 child divs (team entries)
 *   - Winner has class="winner"
 *   - Seed in <span>, team name in school <a>, score in boxscore <a>
 *
 * @module
 */

import { JSDOM } from "jsdom";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = "https://www.sports-reference.com/cbb/postseason/men";
const CRAWL_DELAY_MS = 5_000;
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../src/lib/backtest/historical-results.ts"
);

/** Seasons to scrape (2020 excluded — cancelled) */
const SEASONS = [
  2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019,
  2021, 2022, 2023, 2024, 2025,
];

/** Anomalous seasons with known confounding factors */
const ANOMALOUS: Record<number, string> = {
  2021: "COVID bubble — all games in Indianapolis",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameResult {
  season: number;
  round: string;
  region?: string;
  winnerName: string;
  winnerSeed: number;
  loserName: string;
  loserSeed: number;
}

interface SeasonResult {
  season: number;
  anomalous: boolean;
  anomalyNote?: string;
  games: GameResult[];
}

// ---------------------------------------------------------------------------
// Team name normalization (match Torvik naming)
// ---------------------------------------------------------------------------

const NAME_FIXES: Record<string, string> = {
  UConn: "Connecticut",
  "NC State": "North Carolina St.",
  "N.C. State": "North Carolina St.",
  VCU: "Virginia Commonwealth",
  BYU: "Brigham Young",
  USC: "Southern California",
  TCU: "Texas Christian",
  "Saint Mary's (CA)": "Saint Mary's",
  "St. Mary's (CA)": "Saint Mary's",
  "Saint Peter's": "Saint Peter's",
  "St. Peter's": "Saint Peter's",
  "Saint Joseph's": "Saint Joseph's",
  "St. Joseph's (PA)": "Saint Joseph's",
  "Saint Bonaventure": "Saint Bonaventure",
  "St. Bonaventure": "Saint Bonaventure",
  "Saint John's (NY)": "St. John's",
  "Loyola (MD)": "Loyola MD",
  "Loyola (IL)": "Loyola Chicago",
  "Miami (FL)": "Miami FL",
  "Miami (OH)": "Miami OH",
  FGCU: "Florida Gulf Coast",
  MTSU: "Middle Tennessee",
  SFA: "Stephen F. Austin",
  LIU: "LIU",
  "Texas A&M-Corpus Christi": "Texas A&M Corpus Christi",
  "Texas A&M–Corpus Christi": "Texas A&M Corpus Christi",
  UMBC: "UMBC",
  FDU: "Fairleigh Dickinson",
  Grambling: "Grambling",
  McNeese: "McNeese",
  "Montana State": "Montana St.",
  "Morehead State": "Morehead St.",
  "Murray State": "Murray St.",
  "Weber State": "Weber St.",
  "Wichita State": "Wichita St.",
  "Oregon State": "Oregon St.",
  "Ohio State": "Ohio St.",
  "Penn State": "Penn St.",
  "Michigan State": "Michigan St.",
  "Iowa State": "Iowa St.",
  "Kansas State": "Kansas St.",
  "Arizona State": "Arizona St.",
  "Colorado State": "Colorado St.",
  "Boise State": "Boise St.",
  "San Diego State": "San Diego St.",
  "Fresno State": "Fresno St.",
  "Florida State": "Florida St.",
  "Mississippi State": "Mississippi St.",
  "Appalachian State": "Appalachian St.",
  "Wright State": "Wright St.",
  "Norfolk State": "Norfolk St.",
  "Kennesaw State": "Kennesaw St.",
  "Cleveland State": "Cleveland St.",
  "South Dakota State": "South Dakota St.",
  "North Dakota State": "North Dakota St.",
  "Cal State Fullerton": "Cal St. Fullerton",
  "Cal State Bakersfield": "Cal St. Bakersfield",
  "Jackson State": "Jackson St.",
  "Portland State": "Portland St.",
  "Southeast Missouri State": "Southeast Missouri St.",
  "Grambling State": "Grambling",
  "McNeese State": "McNeese",
  "Long Island University": "LIU",
  "Georgia State": "Georgia St.",
  "Coppin State": "Coppin St.",
  "Sacramento State": "Sacramento St.",
  "Sam Houston State": "Sam Houston St.",
  "Sam Houston": "Sam Houston St.",
  "Texas State": "Texas St.",
  "Arkansas State": "Arkansas St.",
  "Indiana State": "Indiana St.",
  "Illinois State": "Illinois St.",
  "Kent State": "Kent St.",
  "Ball State": "Ball St.",
  "Alabama-Birmingham": "UAB",
  "Loyola Marymount": "Loyola Marymount",
  "North Carolina Central": "North Carolina Central",
  "Texas Southern": "Texas Southern",
  "Abilene Christian": "Abilene Christian",
  "Western Kentucky": "Western Kentucky",
  "Eastern Washington": "Eastern Washington",
  "Grand Canyon": "Grand Canyon",
  "Oral Roberts": "Oral Roberts",
  "UC Davis": "UC Davis",
  "UC Irvine": "UC Irvine",
  "UC Santa Barbara": "UC Santa Barbara",
};

function normalizeTeamName(name: string): string {
  const trimmed = name.trim();
  return NAME_FIXES[trimmed] ?? trimmed;
}

// ---------------------------------------------------------------------------
// Round assignment per position within a region bracket
// ---------------------------------------------------------------------------

/** Round assignments for the 15 games in a region bracket (8 + 4 + 2 + 1) */
const REGION_ROUNDS = [
  "R64", "R64", "R64", "R64", "R64", "R64", "R64", "R64", // Round 0: 8 games
  "R32", "R32", "R32", "R32",                               // Round 1: 4 games
  "S16", "S16",                                              // Round 2: 2 games
  "E8",                                                      // Round 3: 1 game
];

/** Round assignments for the 3 games in the national bracket (2 + 1) */
const NATIONAL_ROUNDS = ["F4", "F4", "NCG"];

// ---------------------------------------------------------------------------
// HTML Parsing
// ---------------------------------------------------------------------------

/**
 * Parses a single team div from the bracket.
 */
function parseTeamDiv(
  div: Element
): { name: string; seed: number; score: number; isWinner: boolean } | null {
  const isWinner = div.classList.contains("winner");

  // Get seed from <span> element
  const seedSpan = div.querySelector("span");
  const seedText = seedSpan?.textContent?.trim() ?? "";
  const seed = parseInt(seedText, 10);
  if (isNaN(seed)) return null;

  // Get team name and score from links
  const links = div.querySelectorAll("a[href]");
  let name = "";
  let score = 0;

  for (const link of links) {
    const href = link.getAttribute("href") ?? "";
    const text = link.textContent?.trim() ?? "";

    if (href.includes("/cbb/schools/")) {
      name = text;
    } else if (href.includes("/cbb/boxscores/") && /^\d+$/.test(text)) {
      score = parseInt(text, 10);
    }
  }

  if (!name) return null;

  return { name, seed, score, isWinner };
}

/**
 * Parses all games from a bracket element (used for both regional and national).
 */
function parseBracketGames(
  bracketEl: Element,
  season: number,
  region: string | undefined,
  roundSequence: string[]
): GameResult[] {
  const games: GameResult[] = [];
  const roundDivs = bracketEl.querySelectorAll(":scope > .round");
  let gameIdx = 0;

  for (const roundDiv of roundDivs) {
    const children = roundDiv.children;

    for (let i = 0; i < children.length; i++) {
      const gameContainer = children[i];
      const teamDivs = gameContainer.querySelectorAll(":scope > div");
      if (teamDivs.length < 2) continue;

      const team1 = parseTeamDiv(teamDivs[0]);
      const team2 = parseTeamDiv(teamDivs[1]);
      if (!team1 || !team2) continue;
      if (team1.score === 0 && team2.score === 0) continue;

      // Determine winner/loser using the .winner class
      let winner: typeof team1;
      let loser: typeof team1;

      if (team1.isWinner) {
        winner = team1;
        loser = team2;
      } else if (team2.isWinner) {
        winner = team2;
        loser = team1;
      } else {
        // Fallback: higher score wins
        winner = team1.score > team2.score ? team1 : team2;
        loser = team1.score > team2.score ? team2 : team1;
      }

      const round = gameIdx < roundSequence.length ? roundSequence[gameIdx] : "R64";

      games.push({
        season,
        round,
        region,
        winnerName: normalizeTeamName(winner.name),
        winnerSeed: winner.seed,
        loserName: normalizeTeamName(loser.name),
        loserSeed: loser.seed,
      });

      gameIdx++;
    }
  }

  return games;
}

/**
 * Scrapes a single season's bracket page from sports-reference.com.
 *
 * The page has regional sections (#east, #midwest, #south, #west, #national),
 * each with its own bracket element containing .round column divs.
 */
async function scrapeSeason(season: number): Promise<GameResult[]> {
  const url = `${BASE_URL}/${season}-ncaa.html`;
  console.log(`  Fetching ${url}...`);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "MarchMadnessPredictor/1.0 (educational project; rate-limited to 1 req per 5s)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const allGames: GameResult[] = [];

  // Detect which region IDs are on this page.
  // Region names changed over the years:
  //   Modern (most years): east, midwest, south, west
  //   2011: east, southeast, southwest, west
  //   Some older years: may use other combinations
  // We dynamically discover regions from the #brackets container.
  const bracketsContainer = doc.querySelector("#brackets");
  const regionIds: string[] = [];

  if (bracketsContainer) {
    for (let i = 0; i < bracketsContainer.children.length; i++) {
      const child = bracketsContainer.children[i];
      if (child.id && child.id !== "national") {
        regionIds.push(child.id);
      }
    }
  }

  // Fallback if #brackets not found
  if (regionIds.length === 0) {
    regionIds.push("east", "midwest", "south", "west");
  }

  for (const regionId of regionIds) {
    const regionDiv = doc.querySelector(`#${regionId}`);
    if (!regionDiv) {
      console.warn(`  WARNING: No #${regionId} section found`);
      continue;
    }

    // Find the bracket element within the region
    const bracketEl = regionDiv.querySelector(
      '[class^="team"]'
    );
    if (!bracketEl) {
      console.warn(`  WARNING: No bracket element in #${regionId}`);
      continue;
    }

    // Capitalize region name for our data format
    const regionName =
      regionId.charAt(0).toUpperCase() + regionId.slice(1);

    const games = parseBracketGames(
      bracketEl,
      season,
      regionName,
      REGION_ROUNDS
    );
    allGames.push(...games);
  }

  // Parse the national bracket (Final Four + Championship)
  const nationalDiv = doc.querySelector("#national");
  if (nationalDiv) {
    const bracketEl = nationalDiv.querySelector(
      '[class^="team"]'
    );
    if (bracketEl) {
      const games = parseBracketGames(
        bracketEl,
        season,
        undefined,
        NATIONAL_ROUNDS
      );
      allGames.push(...games);
    }
  }

  // Remove play-in/First Four games.
  // First Four games occur only in R64 and have two teams with the same seed
  // (e.g., two 16-seeds or two 11-seeds playing for the right to enter the bracket).
  // Note: Same-seed matchups CAN occur legitimately in later rounds (e.g., two 1-seeds
  // in the championship), so we only filter R64 same-seed games.
  const filtered = allGames.filter(
    (g) => !(g.round === "R64" && g.winnerSeed === g.loserSeed)
  );

  // If we still have more than 63, trim excess from the beginning
  if (filtered.length > 63) {
    console.warn(
      `  WARNING: ${filtered.length} games after First Four filter, expected 63. Trimming extras.`
    );
    return filtered.slice(filtered.length - 63);
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Output generation
// ---------------------------------------------------------------------------

function generateOutputFile(results: SeasonResult[]): string {
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * Historical NCAA tournament results (2008–2024).`);
  lines.push(` *`);
  lines.push(` * Auto-generated by scripts/scrape-tournament-results.ts`);
  lines.push(` * Generated: ${new Date().toISOString()}`);
  lines.push(` *`);
  lines.push(` * Each season contains all 63 games from the 64-team bracket`);
  lines.push(` * (First Four play-in games are excluded).`);
  lines.push(` * 2020 is excluded (tournament cancelled due to COVID).`);
  lines.push(` *`);
  lines.push(` * Team names use Torvik naming conventions.`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import type { TournamentResults } from "@/types/backtest";`);
  lines.push(``);

  // Generate the data using JSON.stringify but with cleaner formatting
  const jsonStr = JSON.stringify(results, null, 2);

  lines.push(`export const HISTORICAL_RESULTS: TournamentResults[] = ${jsonStr};`);
  lines.push(``);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== NCAA Tournament Results Scraper ===");
  console.log(`Scraping ${SEASONS.length} seasons from sports-reference.com`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log();

  const results: SeasonResult[] = [];

  for (let i = 0; i < SEASONS.length; i++) {
    const season = SEASONS[i];
    console.log(
      `[${i + 1}/${SEASONS.length}] Scraping ${season} tournament...`
    );

    try {
      const games = await scrapeSeason(season);
      console.log(`  Found ${games.length} games`);

      if (games.length !== 63) {
        console.warn(
          `  WARNING: Expected 63 games, got ${games.length}. Data may be incomplete.`
        );
      }

      results.push({
        season,
        anomalous: !!ANOMALOUS[season],
        anomalyNote: ANOMALOUS[season],
        games,
      });
    } catch (err) {
      console.error(
        `  ERROR scraping ${season}:`,
        err instanceof Error ? err.message : err
      );
      console.error(`  Skipping this season.`);
    }

    // Rate limit between requests
    if (i < SEASONS.length - 1) {
      console.log(
        `  Waiting ${CRAWL_DELAY_MS / 1000}s before next request...`
      );
      await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));
    }
  }

  // Generate output file
  console.log();
  console.log(`Generating output file...`);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const content = generateOutputFile(results);
  fs.writeFileSync(OUTPUT_PATH, content, "utf-8");

  console.log(`Written to ${OUTPUT_PATH}`);
  console.log();
  console.log("=== Summary ===");
  console.log(`Seasons scraped: ${results.length}/${SEASONS.length}`);
  console.log(
    `Total games: ${results.reduce((sum, r) => sum + r.games.length, 0)}`
  );

  const incomplete = results.filter((r) => r.games.length !== 63);
  if (incomplete.length > 0) {
    console.log(
      `Incomplete seasons: ${incomplete.map((r) => `${r.season} (${r.games.length} games)`).join(", ")}`
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
