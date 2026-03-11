/**
 * Site-to-matchup mapping utility.
 *
 * Maps each gameId in the bracket to the tournament venue coordinates
 * where that game is played. Pre-computed once before simulation runs
 * for efficient 10k-100k iteration loops.
 *
 * Site assignment logic by round:
 * - R64/R32: Each region has up to 2 pod sites. Games 1-4 go to the first
 *   site (alphabetically), games 5-8 to the second. If only one site, all
 *   games use it.
 * - S16/E8: One site per region.
 * - F4/NCG: One national site (no region filter).
 *
 * Graceful degradation: if no matching site is found for a game, that gameId
 * is omitted from the map and the site proximity lever returns 0 for that game.
 */

import type { TournamentSite } from "@/types/team";
import type { BracketMatchup } from "@/types/simulation";
import type { GameSiteCoordinates } from "@/types/engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Map from gameId to the venue coordinates for that game */
export type SiteMap = Map<string, GameSiteCoordinates>;

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
    } else if (round === "R64" || round === "R32") {
      // Pod assignment: sort sites alphabetically by name, assign
      // games 1-4 to first site, games 5-8 to second site.
      // Game number is the trailing number in the gameId (e.g., "R64-East-3" → 3)
      const sortedSites = [...matchingSites].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const gameNum = extractGameNumber(gameId);
      // Games 1-4 → first pod site, games 5-8 → second pod site
      // For R32: games 1-2 → first site, games 3-4 → second site
      const midpoint = round === "R64" ? 4 : 2;
      selectedSite =
        gameNum <= midpoint ? sortedSites[0] : sortedSites[1] ?? sortedSites[0];
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
