/**
 * Site-to-matchup mapping utility.
 *
 * Maps each gameId in the bracket to the tournament venue coordinates
 * where that game is played. Pre-computed once before simulation runs
 * for efficient 10k-100k iteration loops.
 *
 * Site assignment logic by round:
 * - R64: Sites declare which seed lines they host via `seedMatchups`
 *   (e.g., [1, 16, 8, 9] means this venue hosts the 1v16 and 8v9 games).
 *   Falls back to game-number heuristic if seed matchups not provided.
 * - R32: Inherits from R64 pod sites — the R32 game is at the same venue
 *   as its feeder R64 games (matched via seed lines).
 * - S16/E8: One site per region.
 * - F4/NCG: One national site (no region filter).
 *
 * Graceful degradation: if no matching site is found for a game, that gameId
 * is omitted from the map and the site proximity lever returns 0 for that game.
 */

import type { TournamentSite } from "@/types/team";
import type { BracketMatchup } from "@/types/simulation";
import type { GameSiteCoordinates } from "@/types/engine";
import { BRACKET_SEED_MATCHUPS } from "@/lib/engine/bracket";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Map from gameId to the venue coordinates for that game */
export type SiteMap = Map<string, GameSiteCoordinates>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maps R64 game numbers to the seed lines involved.
 * Game 1 = BRACKET_SEED_MATCHUPS[0] = [1,16], etc.
 */
const GAME_NUM_TO_SEEDS: Map<number, [number, number]> = new Map(
  BRACKET_SEED_MATCHUPS.map((pair, i) => [i + 1, pair])
);

/**
 * Maps R32 game numbers to the R64 seed lines that feed into them.
 * R32 game 1 ← R64 games 1+2 → seeds [1,16,8,9]
 * R32 game 2 ← R64 games 3+4 → seeds [5,12,4,13]
 * R32 game 3 ← R64 games 5+6 → seeds [6,11,3,14]
 * R32 game 4 ← R64 games 7+8 → seeds [7,10,2,15]
 */
const R32_GAME_SEEDS: Map<number, number[]> = new Map([
  [1, [1, 16, 8, 9]],
  [2, [5, 12, 4, 13]],
  [3, [6, 11, 3, 14]],
  [4, [7, 10, 2, 15]],
]);

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Builds a map from gameId to the venue coordinates where that game is played.
 *
 * @param matchups - The 63-game bracket matchup array (from buildBracketMatchups)
 * @param sites - Tournament site data from Supabase
 * @returns A Map from gameId to GameSiteCoordinates
 */
export function buildSiteMap(
  matchups: BracketMatchup[],
  sites: TournamentSite[]
): SiteMap {
  const siteMap: SiteMap = new Map();

  if (sites.length === 0) {
    return siteMap;
  }

  for (const matchup of matchups) {
    const { gameId, round, region } = matchup;

    // Find matching sites for this game
    let matchingSites: TournamentSite[];

    if (region) {
      // Regional games (R64-E8): filter by round AND region
      matchingSites = sites.filter(
        (s) =>
          s.rounds.includes(round) &&
          s.regions !== undefined &&
          s.regions.length > 0 &&
          s.regions.includes(region)
      );
    } else {
      // National games (F4/NCG): filter by round only
      matchingSites = sites.filter((s) => s.rounds.includes(round));
    }

    if (matchingSites.length === 0) {
      continue; // No site found — graceful degradation
    }

    let selectedSite: TournamentSite;

    if (matchingSites.length === 1) {
      // Only one site — use it for all games
      selectedSite = matchingSites[0];
    } else if (round === "R64") {
      selectedSite = findR64Site(matchingSites, gameId);
    } else if (round === "R32") {
      selectedSite = findR32Site(matchingSites, sites, gameId, region!);
    } else {
      // S16/E8 with multiple matches (unusual) — use first alphabetically
      selectedSite = [...matchingSites].sort((a, b) =>
        a.name.localeCompare(b.name)
      )[0];
    }

    siteMap.set(gameId, {
      latitude: selectedSite.latitude,
      longitude: selectedSite.longitude,
      name: selectedSite.name,
      city: selectedSite.city,
      state: selectedSite.state,
    });
  }

  return siteMap;
}

// ---------------------------------------------------------------------------
// Round-specific site finders
// ---------------------------------------------------------------------------

/**
 * Finds the correct R64 site for a game using seed matchup data.
 *
 * If sites have `seedMatchups` defined, matches the game's seed lines
 * against each site's declared seeds. Falls back to the old game-number
 * heuristic (games 1-4 → first site, 5-8 → second) if no seed data.
 */
function findR64Site(
  matchingSites: TournamentSite[],
  gameId: string
): TournamentSite {
  const gameNum = extractGameNumber(gameId);
  const seedPair = GAME_NUM_TO_SEEDS.get(gameNum);

  // Try seed-based matching first
  if (seedPair) {
    const siteWithSeeds = matchingSites.find(
      (s) =>
        s.seedMatchups &&
        s.seedMatchups.length > 0 &&
        seedPair.some((seed) => s.seedMatchups!.includes(seed))
    );
    if (siteWithSeeds) {
      return siteWithSeeds;
    }
  }

  // Fallback: game-number heuristic (games 1-4 → first site, 5-8 → second)
  const sortedSites = [...matchingSites].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return gameNum <= 4
    ? sortedSites[0]
    : sortedSites[1] ?? sortedSites[0];
}

/**
 * Finds the correct R32 site for a game.
 *
 * R32 games are played at the same venue as their feeder R64 games.
 * Uses the R64 sites' seed matchup data to determine which pod site
 * hosts this R32 game. Falls back to heuristic if no seed data.
 */
function findR32Site(
  matchingR32Sites: TournamentSite[],
  allSites: TournamentSite[],
  gameId: string,
  region: string
): TournamentSite {
  const gameNum = extractGameNumber(gameId);
  const r32Seeds = R32_GAME_SEEDS.get(gameNum);

  if (r32Seeds) {
    // Find the R64 site that hosts these seed lines
    const r64SitesForRegion = allSites.filter(
      (s) =>
        s.rounds.includes("R64") &&
        s.regions !== undefined &&
        s.regions.length > 0 &&
        s.regions.includes(region as "East" | "West" | "South" | "Midwest") &&
        s.seedMatchups &&
        s.seedMatchups.length > 0
    );

    // Find the R64 pod site whose seeds overlap with this R32 game's feeder seeds
    const matchingR64Site = r64SitesForRegion.find((s) =>
      r32Seeds.some((seed) => s.seedMatchups!.includes(seed))
    );

    if (matchingR64Site) {
      // Find the R32 site at the same location (city+state match)
      const colocatedR32Site = matchingR32Sites.find(
        (s) => s.city === matchingR64Site.city && s.state === matchingR64Site.state
      );
      if (colocatedR32Site) {
        return colocatedR32Site;
      }

      // If R64 and R32 are the same site record (rounds include both)
      if (matchingR64Site.rounds.includes("R32")) {
        return matchingR64Site;
      }
    }
  }

  // Fallback: game-number heuristic (games 1-2 → first site, 3-4 → second)
  const sortedSites = [...matchingR32Sites].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return gameNum <= 2
    ? sortedSites[0]
    : sortedSites[1] ?? sortedSites[0];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the game number from a gameId.
 * E.g., "R64-East-3" → 3, "R32-West-1" → 1, "F4-1" → 1, "NCG" → 1
 */
function extractGameNumber(gameId: string): number {
  const parts = gameId.split("-");
  const lastPart = parts[parts.length - 1];
  const num = parseInt(lastPart, 10);
  return isNaN(num) ? 1 : num;
}
