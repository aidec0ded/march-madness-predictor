/**
 * Shared test helpers for the probability engine test suites.
 *
 * Provides factory functions that create realistic mock TeamSeason objects
 * at various strength tiers (strong, mid, weak, average). Each factory
 * accepts a partial override object so tests can tweak individual fields
 * without rebuilding the entire structure.
 */

import type {
  TeamSeason,
  CoachRecord,
  FourFactors,
  ShootingSplits,
} from "@/types/team";

// ---------------------------------------------------------------------------
// Helper: deep merge with override
// ---------------------------------------------------------------------------

/**
 * Recursively merges an override into a base object, creating a new object.
 * Arrays are replaced wholesale rather than merged.
 * Uses `any` intentionally — this is test-only utility code.
 */
function deepMerge(base: any, override?: any): any {
  if (!override) return { ...base };
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    const baseVal = result[key];
    if (
      overrideVal !== undefined &&
      overrideVal !== null &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal) &&
      baseVal !== null
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Default building blocks
// ---------------------------------------------------------------------------

const DEFAULT_FOUR_FACTORS_OFFENSE: FourFactors = {
  efgPct: 51.0,
  toPct: 18.5,
  orbPct: 30.0,
  ftRate: 32.0,
};

const DEFAULT_FOUR_FACTORS_DEFENSE: FourFactors = {
  efgPct: 49.5,
  toPct: 19.0,
  orbPct: 27.5,
  ftRate: 30.0,
};

const DEFAULT_SHOOTING_OFFENSE: ShootingSplits = {
  threePtPct: 34.5,
  threePtRate: 35.0,
  ftPct: 72.0,
};

const DEFAULT_SHOOTING_DEFENSE: ShootingSplits = {
  threePtPct: 33.0,
  threePtRate: 34.0,
  ftPct: 70.0,
};

const DEFAULT_COACH: CoachRecord = {
  name: "Coach Average",
  tournamentGames: 20,
  tournamentWins: 10,
  finalFours: 1,
  championships: 0,
  yearsHeadCoach: 10,
};

// ---------------------------------------------------------------------------
// Factory: average team (D1 median, ~50th percentile)
// ---------------------------------------------------------------------------

/**
 * Creates a mock TeamSeason representing a roughly average D1 team.
 *
 * - AdjEM around +5 (slightly above replacement to represent a tournament-quality floor)
 * - Standard tempo, shooting, and experience values
 *
 * @param overrides - Partial overrides to merge on top of the defaults
 */
export function createMockTeamSeason(
  overrides?: Record<string, unknown>
): TeamSeason {
  const base: TeamSeason = {
    id: "team-avg-2025",
    teamId: "avg",
    season: 2025,
    team: {
      id: "avg",
      name: "Average State Cougars",
      shortName: "AVG ST",
      conference: "MVC",
      campus: {
        city: "Springfield",
        state: "IL",
        latitude: 39.7817,
        longitude: -89.6501,
      },
    },
    ratings: {
      kenpom: { source: "kenpom", adjOE: 108.0, adjDE: 103.0, adjEM: 5.0 },
      torvik: { source: "torvik", adjOE: 107.5, adjDE: 103.5, adjEM: 4.0 },
      evanmiya: { source: "evanmiya", adjOE: 108.5, adjDE: 102.5, adjEM: 6.0 },
    },
    fourFactorsOffense: { ...DEFAULT_FOUR_FACTORS_OFFENSE },
    fourFactorsDefense: { ...DEFAULT_FOUR_FACTORS_DEFENSE },
    shootingOffense: { ...DEFAULT_SHOOTING_OFFENSE },
    shootingDefense: { ...DEFAULT_SHOOTING_DEFENSE },
    adjTempo: 68.0,
    avgPossLengthOff: 16.5,
    avgPossLengthDef: 16.8,
    benchMinutesPct: 32.0,
    experience: 2.0,
    minutesContinuity: 55.0,
    avgHeight: 76.5,
    twoFoulParticipation: 40.0,
    sosNetRating: 0,
    sosOffRating: 0,
    sosDefRating: 0,
    luck: 0,
    evanmiyaOpponentAdjust: 0,
    evanmiyaPaceAdjust: 0,
    evanmiyaKillShotsPerGame: 0,
    evanmiyaKillShotsAllowedPerGame: 0,
    evanmiyaKillShotsMargin: 0,
    coach: { ...DEFAULT_COACH },
    tournamentEntry: { seed: 10, region: "East", bracketPosition: 10 },
    updatedAt: "2025-03-01T00:00:00Z",
    dataSources: ["kenpom", "torvik", "evanmiya"],
  };

  return deepMerge(base, overrides);
}

// ---------------------------------------------------------------------------
// Factory: strong team (1-seed caliber, adjEM ~28-30)
// ---------------------------------------------------------------------------

/**
 * Creates a mock TeamSeason representing a 1-seed caliber team.
 *
 * - AdjEM around 28-30 (elite program)
 * - Excellent Four Factors across the board
 * - Experienced roster with strong coaching history
 *
 * @param overrides - Partial overrides to merge on top of the defaults
 */
export function createStrongTeam(
  overrides?: Record<string, unknown>
): TeamSeason {
  const base: TeamSeason = {
    id: "team-strong-2025",
    teamId: "strong",
    season: 2025,
    team: {
      id: "strong",
      name: "Elite University Knights",
      shortName: "ELITE",
      conference: "Big 12",
      campus: {
        city: "Lawrence",
        state: "KS",
        latitude: 38.9717,
        longitude: -95.2353,
      },
    },
    ratings: {
      kenpom: { source: "kenpom", adjOE: 121.0, adjDE: 92.0, adjEM: 29.0 },
      torvik: { source: "torvik", adjOE: 120.5, adjDE: 92.5, adjEM: 28.0 },
      evanmiya: { source: "evanmiya", adjOE: 121.5, adjDE: 91.5, adjEM: 30.0 },
    },
    fourFactorsOffense: {
      efgPct: 56.0,
      toPct: 15.0,
      orbPct: 34.0,
      ftRate: 38.0,
    },
    fourFactorsDefense: {
      efgPct: 44.0,
      toPct: 22.0,
      orbPct: 23.0,
      ftRate: 26.0,
    },
    shootingOffense: {
      threePtPct: 38.0,
      threePtRate: 37.0,
      ftPct: 78.0,
    },
    shootingDefense: {
      threePtPct: 30.0,
      threePtRate: 32.0,
      ftPct: 68.0,
    },
    adjTempo: 69.5,
    avgPossLengthOff: 15.8,
    avgPossLengthDef: 17.2,
    benchMinutesPct: 28.0,
    experience: 2.8,
    minutesContinuity: 68.0,
    avgHeight: 78.0,
    twoFoulParticipation: 35.0,
    sosNetRating: 0,
    sosOffRating: 0,
    sosDefRating: 0,
    luck: 0,
    evanmiyaOpponentAdjust: 0,
    evanmiyaPaceAdjust: 0,
    evanmiyaKillShotsPerGame: 0,
    evanmiyaKillShotsAllowedPerGame: 0,
    evanmiyaKillShotsMargin: 0,
    coach: {
      name: "Coach Elite",
      tournamentGames: 60,
      tournamentWins: 40,
      finalFours: 5,
      championships: 2,
      yearsHeadCoach: 20,
    },
    tournamentEntry: { seed: 1, region: "South", bracketPosition: 1 },
    updatedAt: "2025-03-01T00:00:00Z",
    dataSources: ["kenpom", "torvik", "evanmiya"],
  };

  return deepMerge(base, overrides);
}

// ---------------------------------------------------------------------------
// Factory: weak team (14-16 seed, adjEM ~-2 to +3)
// ---------------------------------------------------------------------------

/**
 * Creates a mock TeamSeason representing a 14-16 seed team.
 *
 * - AdjEM around -2 to +3 (low-major conference champion)
 * - Below-average Four Factors
 * - Less experienced roster and limited coach tournament history
 *
 * @param overrides - Partial overrides to merge on top of the defaults
 */
export function createWeakTeam(
  overrides?: Record<string, unknown>
): TeamSeason {
  const base: TeamSeason = {
    id: "team-weak-2025",
    teamId: "weak",
    season: 2025,
    team: {
      id: "weak",
      name: "Small College Eagles",
      shortName: "SC EAG",
      conference: "MEAC",
      campus: {
        city: "Norfolk",
        state: "VA",
        latitude: 36.8508,
        longitude: -76.2859,
      },
    },
    ratings: {
      kenpom: { source: "kenpom", adjOE: 102.0, adjDE: 101.0, adjEM: 1.0 },
      torvik: { source: "torvik", adjOE: 101.0, adjDE: 103.0, adjEM: -2.0 },
      evanmiya: { source: "evanmiya", adjOE: 103.0, adjDE: 100.0, adjEM: 3.0 },
    },
    fourFactorsOffense: {
      efgPct: 47.0,
      toPct: 21.0,
      orbPct: 27.0,
      ftRate: 28.0,
    },
    fourFactorsDefense: {
      efgPct: 52.0,
      toPct: 17.0,
      orbPct: 31.0,
      ftRate: 34.0,
    },
    shootingOffense: {
      threePtPct: 31.0,
      threePtRate: 33.0,
      ftPct: 68.0,
    },
    shootingDefense: {
      threePtPct: 35.0,
      threePtRate: 36.0,
      ftPct: 72.0,
    },
    adjTempo: 66.5,
    avgPossLengthOff: 17.2,
    avgPossLengthDef: 16.0,
    benchMinutesPct: 35.0,
    experience: 1.4,
    minutesContinuity: 42.0,
    avgHeight: 75.5,
    twoFoulParticipation: 45.0,
    sosNetRating: 0,
    sosOffRating: 0,
    sosDefRating: 0,
    luck: 0,
    evanmiyaOpponentAdjust: 0,
    evanmiyaPaceAdjust: 0,
    evanmiyaKillShotsPerGame: 0,
    evanmiyaKillShotsAllowedPerGame: 0,
    evanmiyaKillShotsMargin: 0,
    coach: {
      name: "Coach Underdog",
      tournamentGames: 3,
      tournamentWins: 1,
      finalFours: 0,
      championships: 0,
      yearsHeadCoach: 6,
    },
    tournamentEntry: { seed: 16, region: "South", bracketPosition: 16 },
    updatedAt: "2025-03-01T00:00:00Z",
    dataSources: ["kenpom", "torvik", "evanmiya"],
  };

  return deepMerge(base, overrides);
}

// ---------------------------------------------------------------------------
// Factory: mid team (8/9 seed, adjEM ~12-15)
// ---------------------------------------------------------------------------

/**
 * Creates a mock TeamSeason representing an 8/9 seed team.
 *
 * - AdjEM around 12-15 (solid mid-major or middling power-conference team)
 * - Moderate Four Factors, moderate experience
 *
 * @param overrides - Partial overrides to merge on top of the defaults
 */
export function createMidTeam(overrides?: Record<string, unknown>): TeamSeason {
  const base: TeamSeason = {
    id: "team-mid-2025",
    teamId: "mid",
    season: 2025,
    team: {
      id: "mid",
      name: "Midstate Wolverines",
      shortName: "MIDST",
      conference: "Big East",
      campus: {
        city: "Milwaukee",
        state: "WI",
        latitude: 43.0389,
        longitude: -87.9065,
      },
    },
    ratings: {
      kenpom: { source: "kenpom", adjOE: 113.0, adjDE: 100.0, adjEM: 13.0 },
      torvik: { source: "torvik", adjOE: 112.5, adjDE: 99.5, adjEM: 13.0 },
      evanmiya: { source: "evanmiya", adjOE: 114.0, adjDE: 99.0, adjEM: 15.0 },
    },
    fourFactorsOffense: {
      efgPct: 52.5,
      toPct: 17.5,
      orbPct: 31.0,
      ftRate: 34.0,
    },
    fourFactorsDefense: {
      efgPct: 48.0,
      toPct: 20.0,
      orbPct: 26.0,
      ftRate: 29.0,
    },
    shootingOffense: {
      threePtPct: 35.5,
      threePtRate: 36.0,
      ftPct: 74.0,
    },
    shootingDefense: {
      threePtPct: 32.5,
      threePtRate: 33.0,
      ftPct: 69.0,
    },
    adjTempo: 68.5,
    avgPossLengthOff: 16.2,
    avgPossLengthDef: 16.5,
    benchMinutesPct: 30.0,
    experience: 2.2,
    minutesContinuity: 58.0,
    avgHeight: 77.0,
    twoFoulParticipation: 38.0,
    sosNetRating: 0,
    sosOffRating: 0,
    sosDefRating: 0,
    luck: 0,
    evanmiyaOpponentAdjust: 0,
    evanmiyaPaceAdjust: 0,
    evanmiyaKillShotsPerGame: 0,
    evanmiyaKillShotsAllowedPerGame: 0,
    evanmiyaKillShotsMargin: 0,
    coach: {
      name: "Coach Midrange",
      tournamentGames: 30,
      tournamentWins: 15,
      finalFours: 2,
      championships: 0,
      yearsHeadCoach: 14,
    },
    tournamentEntry: { seed: 8, region: "West", bracketPosition: 8 },
    updatedAt: "2025-03-01T00:00:00Z",
    dataSources: ["kenpom", "torvik", "evanmiya"],
  };

  return deepMerge(base, overrides);
}
