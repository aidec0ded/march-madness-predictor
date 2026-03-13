/**
 * Shared test helpers for bracket and simulation test suites.
 *
 * Provides a factory function to create a full 64-team tournament field
 * with proper seeds, regions, and bracket positions. Each team is built
 * from the createMockTeamSeason factory with appropriate overrides.
 */

import type { TeamSeason, Region, Seed, Conference } from "@/types/team";
import { createMockTeamSeason } from "@/lib/engine/test-helpers";
import { SEED_TO_BRACKET_POSITION } from "@/lib/engine/bracket";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The four NCAA tournament regions */
const REGIONS: Region[] = ["East", "West", "South", "Midwest"];

/** Seeds 1-16 */
const SEEDS: Seed[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

/**
 * Approximate adjEM by seed. Higher seeds get stronger ratings.
 * These are roughly calibrated to historical averages for each seed line.
 */
const SEED_ADJEMS: Record<number, number> = {
  1: 28,
  2: 23,
  3: 20,
  4: 17,
  5: 15,
  6: 13,
  7: 11,
  8: 10,
  9: 9,
  10: 7,
  11: 6,
  12: 5,
  13: 3,
  14: 1,
  15: -1,
  16: -3,
};

// SEED_TO_BRACKET_POSITION is imported from bracket.ts (shared module)

// ---------------------------------------------------------------------------
// Team name generators (for readability in test output)
// ---------------------------------------------------------------------------

/** Conference assignments by seed (realistic distribution) */
const SEED_CONFERENCES: Record<number, Conference[]> = {
  1: ["Big 12", "SEC", "Big Ten", "ACC"],
  2: ["Big 12", "SEC", "Big Ten", "Big East"],
  3: ["SEC", "Big Ten", "ACC", "Big 12"],
  4: ["Big East", "ACC", "Big 12", "SEC"],
  5: ["Big Ten", "Big 12", "SEC", "ACC"],
  6: ["ACC", "Big East", "MWC", "Big 12"],
  7: ["Big East", "MWC", "SEC", "Big Ten"],
  8: ["MWC", "WCC", "Big East", "ACC"],
  9: ["A-10", "MVC", "Big Ten", "SEC"],
  10: ["WCC", "AAC", "MWC", "Big East"],
  11: ["MVC", "AAC", "A-10", "WCC"],
  12: ["CAA", "MAC", "MWC", "AAC"],
  13: ["Horizon", "Ivy", "MAAC", "Patriot"],
  14: ["SoCon", "Summit", "Big Sky", "OVC"],
  15: ["NEC", "MEAC", "Southland", "Big South"],
  16: ["SWAC", "AE", "ASUN", "WAC"],
};

// ---------------------------------------------------------------------------
// Factory: 64-team tournament field
// ---------------------------------------------------------------------------

/**
 * Creates a full 64-team tournament field for simulation testing.
 *
 * Generates 4 regions x 16 seeds = 64 unique TeamSeason objects, each with:
 * - Unique team ID and name
 * - Appropriate seed-based efficiency ratings
 * - Correct tournament entry (seed, region, bracket position)
 * - Realistic conferences by seed line
 *
 * The returned array is in bracket order: all East teams (seed 1-16),
 * then West, South, Midwest.
 *
 * @returns An array of 64 TeamSeason objects forming a complete bracket
 */
export function create64TeamField(): TeamSeason[] {
  const teams: TeamSeason[] = [];

  for (const region of REGIONS) {
    for (const seed of SEEDS) {
      const regionIdx = REGIONS.indexOf(region);
      const adjEM = SEED_ADJEMS[seed];

      // Scale offensive and defensive efficiency based on seed
      const adjOE = 105 + adjEM * 0.55;
      const adjDE = adjOE - adjEM;

      const teamId = `team-${region.toLowerCase()}-${seed}`;
      const shortName = `${region.substring(0, 1)}${seed}`;
      const conference = SEED_CONFERENCES[seed]?.[regionIdx] ?? "Big 12";

      const team = createMockTeamSeason({
        id: `${teamId}-2025`,
        teamId,
        season: 2025,
        team: {
          id: teamId,
          name: `${region} ${seed}-Seed University`,
          shortName,
          conference,
          campus: {
            city: "TestCity",
            state: "TS",
            latitude: 39.0 + regionIdx,
            longitude: -89.0 + seed * 0.1,
          },
        },
        ratings: {
          kenpom: {
            source: "kenpom",
            adjOE: adjOE + 0.5,
            adjDE: adjDE - 0.5,
            adjEM: adjEM + 1.0,
          },
          torvik: {
            source: "torvik",
            adjOE: adjOE - 0.3,
            adjDE: adjDE + 0.3,
            adjEM: adjEM - 0.6,
          },
          evanmiya: {
            source: "evanmiya",
            adjOE: adjOE + 0.1,
            adjDE: adjDE - 0.1,
            adjEM: adjEM + 0.2,
          },
        },
        experience: 1.0 + (17 - seed) * 0.12,
        minutesContinuity: 40 + (17 - seed) * 2.0,
        coach: {
          name: `Coach ${region} ${seed}`,
          tournamentGames: Math.max(3, (17 - seed) * 4),
          tournamentWins: Math.max(1, Math.floor((17 - seed) * 2)),
          finalFours: seed <= 4 ? Math.max(0, 5 - seed) : 0,
          championships: seed === 1 ? 1 : 0,
          yearsHeadCoach: 5 + (17 - seed),
        },
        tournamentEntry: {
          seed: seed as Seed,
          region,
          bracketPosition: SEED_TO_BRACKET_POSITION[seed],
        },
      });

      teams.push(team);
    }
  }

  return teams;
}

/**
 * Creates a minimal 64-team field where all teams are identical except
 * for their IDs, seeds, regions, and bracket positions. Useful for
 * tests that need a valid bracket structure but don't care about
 * realistic team stats.
 *
 * @returns An array of 64 TeamSeason objects
 */
export function create64TeamFieldMinimal(): TeamSeason[] {
  const teams: TeamSeason[] = [];

  for (const region of REGIONS) {
    for (const seed of SEEDS) {
      const teamId = `team-${region.toLowerCase()}-${seed}`;

      const team = createMockTeamSeason({
        id: `${teamId}-2025`,
        teamId,
        team: {
          id: teamId,
          name: `${region} Seed ${seed}`,
          shortName: `${region.substring(0, 1)}${seed}`,
          conference: "Big 12",
          campus: {
            city: "TestCity",
            state: "TS",
            latitude: 39.0,
            longitude: -89.0,
          },
        },
        tournamentEntry: {
          seed: seed as Seed,
          region,
          bracketPosition: SEED_TO_BRACKET_POSITION[seed],
        },
      });

      teams.push(team);
    }
  }

  return teams;
}
