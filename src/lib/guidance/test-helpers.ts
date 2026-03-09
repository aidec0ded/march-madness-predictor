/**
 * Shared test helpers for guidance rule tests.
 *
 * Provides factory functions for building mock TeamSeason objects and
 * GuidanceContext instances with sensible defaults that can be overridden.
 */

import type { TeamSeason, Seed, Region } from "@/types/team";
import type { GuidanceContext } from "@/types/guidance";
import type { GlobalLevers, MatchupOverrides } from "@/types/engine";
import { DEFAULT_GLOBAL_LEVERS } from "@/types/engine";

// ---------------------------------------------------------------------------
// Mock TeamSeason factory
// ---------------------------------------------------------------------------

let teamCounter = 0;

export interface MockTeamOptions {
  teamId?: string;
  shortName?: string;
  seed?: Seed;
  region?: Region;
  adjTempo?: number;
  threePtRate?: number;
  experience?: number;
  minutesContinuity?: number;
  coachTournamentGames?: number;
  coachName?: string;
  kenpomAdjEM?: number;
  torvikAdjEM?: number;
  evanmiyaAdjEM?: number;
}

export function createMockTeam(options: MockTeamOptions = {}): TeamSeason {
  teamCounter++;
  const id = options.teamId ?? `team-${teamCounter}`;
  const shortName = options.shortName ?? `Team ${teamCounter}`;
  const seed = options.seed ?? (1 as Seed);
  const region = options.region ?? "East";

  return {
    id: `season-${id}`,
    teamId: id,
    season: 2026,
    team: {
      id,
      name: `${shortName} University`,
      shortName,
      conference: "Big 12",
      campus: {
        city: "Test City",
        state: "TX",
        latitude: 32.0,
        longitude: -97.0,
      },
    },
    ratings: {
      kenpom: options.kenpomAdjEM !== undefined
        ? { source: "kenpom", adjOE: 115, adjDE: 95, adjEM: options.kenpomAdjEM }
        : { source: "kenpom", adjOE: 115, adjDE: 95, adjEM: 20 },
      torvik: options.torvikAdjEM !== undefined
        ? { source: "torvik", adjOE: 114, adjDE: 96, adjEM: options.torvikAdjEM }
        : { source: "torvik", adjOE: 114, adjDE: 96, adjEM: 18 },
      evanmiya: options.evanmiyaAdjEM !== undefined
        ? { source: "evanmiya", adjOE: 113, adjDE: 97, adjEM: options.evanmiyaAdjEM }
        : { source: "evanmiya", adjOE: 113, adjDE: 97, adjEM: 16 },
    },
    fourFactorsOffense: { efgPct: 0.54, toPct: 0.17, orbPct: 0.32, ftRate: 0.35 },
    fourFactorsDefense: { efgPct: 0.46, toPct: 0.2, orbPct: 0.25, ftRate: 0.28 },
    shootingOffense: {
      threePtPct: 0.36,
      threePtRate: options.threePtRate ?? 0.34,
      ftPct: 0.75,
    },
    shootingDefense: {
      threePtPct: 0.31,
      threePtRate: 0.33,
      ftPct: 0.7,
    },
    adjTempo: options.adjTempo ?? 68,
    avgPossLengthOff: 16.5,
    avgPossLengthDef: 17.0,
    benchMinutesPct: 0.3,
    experience: options.experience ?? 2.2,
    minutesContinuity: options.minutesContinuity ?? 0.55,
    avgHeight: 77,
    twoFoulParticipation: 0.35,
    coach: {
      name: options.coachName ?? "Coach Test",
      tournamentGames: options.coachTournamentGames ?? 15,
      tournamentWins: 8,
      finalFours: 1,
      championships: 0,
      yearsHeadCoach: 10,
    },
    tournamentEntry: {
      seed,
      region,
      bracketPosition: seed,
    },
    updatedAt: "2026-03-01T00:00:00Z",
    dataSources: ["kenpom", "torvik", "evanmiya"],
  };
}

// ---------------------------------------------------------------------------
// Mock GuidanceContext factory
// ---------------------------------------------------------------------------

export interface MockContextOptions {
  picks?: Record<string, string>;
  teams?: TeamSeason[];
  globalLevers?: Partial<GlobalLevers>;
  matchupOverrides?: Record<string, MatchupOverrides>;
}

export function createMockContext(
  options: MockContextOptions = {}
): GuidanceContext {
  const teamsMap = new Map<string, TeamSeason>();
  for (const team of options.teams ?? []) {
    teamsMap.set(team.teamId, team);
  }

  return {
    picks: options.picks ?? {},
    teams: teamsMap,
    globalLevers: {
      ...DEFAULT_GLOBAL_LEVERS,
      ...options.globalLevers,
    },
    matchupOverrides: options.matchupOverrides ?? {},
    simulationResult: null,
  };
}
