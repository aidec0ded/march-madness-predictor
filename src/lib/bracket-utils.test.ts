/**
 * Tests for bracket-utils — filterToMainBracket, resolveSlotTeam, resolveMatchupTeams.
 */

import { describe, it, expect } from "vitest";
import { filterToMainBracket, resolveSlotTeam } from "./bracket-utils";
import {
  createStrongTeam,
  createWeakTeam,
  createMidTeam,
  createMockTeamSeason,
} from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// filterToMainBracket
// ---------------------------------------------------------------------------

describe("filterToMainBracket", () => {
  it("passes through teams with no duplicates unchanged", () => {
    const teams = [
      createStrongTeam({
        id: "t1",
        teamId: "duke",
        tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
      }),
      createWeakTeam({
        id: "t2",
        teamId: "fdu",
        tournamentEntry: { seed: 16, region: "East", bracketPosition: 2 },
      }),
      createMidTeam({
        id: "t3",
        teamId: "marq",
        tournamentEntry: { seed: 8, region: "West", bracketPosition: 3 },
      }),
    ];

    const result = filterToMainBracket(teams);
    expect(result).toHaveLength(3);
  });

  it("deduplicates play-in pairs at the same region+seed", () => {
    // Two 16-seeds in the East region (play-in pair)
    const strongPlayIn = createMidTeam({
      id: "playin-strong",
      teamId: "team-a",
      team: { id: "team-a", name: "Team A", shortName: "A", conference: "Big East" },
      ratings: {
        kenpom: { source: "kenpom", adjOE: 105, adjDE: 102, adjEM: 3.0 },
      },
      tournamentEntry: { seed: 16, region: "East", bracketPosition: 2 },
    });

    const weakPlayIn = createWeakTeam({
      id: "playin-weak",
      teamId: "team-b",
      team: { id: "team-b", name: "Team B", shortName: "B", conference: "MEAC" },
      ratings: {
        kenpom: { source: "kenpom", adjOE: 100, adjDE: 103, adjEM: -3.0 },
      },
      tournamentEntry: { seed: 16, region: "East", bracketPosition: 2 },
    });

    const otherTeam = createStrongTeam({
      id: "other",
      teamId: "duke",
      tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
    });

    const result = filterToMainBracket([weakPlayIn, strongPlayIn, otherTeam]);
    expect(result).toHaveLength(2);

    // Should keep the stronger team (adjEM 3.0 > -3.0)
    const slot16 = result.find((t) => t.tournamentEntry?.seed === 16);
    expect(slot16?.teamId).toBe("team-a");
  });

  it("keeps the higher-rated team from a play-in pair", () => {
    // Two 11-seeds in the South region
    const teamHighRated = createMidTeam({
      id: "high",
      teamId: "high-rated",
      ratings: {
        kenpom: { source: "kenpom", adjOE: 112, adjDE: 100, adjEM: 12.0 },
      },
      tournamentEntry: { seed: 11, region: "South", bracketPosition: 10 },
    });

    const teamLowRated = createMockTeamSeason({
      id: "low",
      teamId: "low-rated",
      ratings: {
        kenpom: { source: "kenpom", adjOE: 105, adjDE: 103, adjEM: 2.0 },
      },
      tournamentEntry: { seed: 11, region: "South", bracketPosition: 10 },
    });

    const result = filterToMainBracket([teamLowRated, teamHighRated]);
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("high-rated");
  });

  it("handles realistic 68-team field → 64 teams", () => {
    // Build 64 normal teams + 4 play-in extras (2 extra at seed 11, 2 extra at seed 16)
    const teams = [];
    const regions = ["East", "West", "South", "Midwest"] as const;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    let idx = 0;

    for (const region of regions) {
      for (const seed of seeds) {
        teams.push(
          createMockTeamSeason({
            id: `team-${idx}`,
            teamId: `team-${idx}`,
            team: { id: `team-${idx}`, name: `Team ${idx}`, shortName: `T${idx}`, conference: "Conf" },
            ratings: {
              kenpom: { source: "kenpom", adjOE: 110, adjDE: 100, adjEM: 10.0 - idx * 0.1 },
            },
            tournamentEntry: { seed, region, bracketPosition: seed },
          })
        );
        idx++;
      }
    }

    // 64 teams so far. Add 4 play-in extras (2 at seed 11, 2 at seed 16)
    // Play-in at East-16 (extra)
    teams.push(
      createWeakTeam({
        id: "playin-e16",
        teamId: "playin-e16",
        ratings: { kenpom: { source: "kenpom", adjOE: 98, adjDE: 105, adjEM: -7.0 } },
        tournamentEntry: { seed: 16, region: "East", bracketPosition: 2 },
      })
    );
    // Play-in at West-16 (extra)
    teams.push(
      createWeakTeam({
        id: "playin-w16",
        teamId: "playin-w16",
        ratings: { kenpom: { source: "kenpom", adjOE: 97, adjDE: 106, adjEM: -9.0 } },
        tournamentEntry: { seed: 16, region: "West", bracketPosition: 2 },
      })
    );
    // Play-in at South-11 (extra)
    teams.push(
      createMockTeamSeason({
        id: "playin-s11",
        teamId: "playin-s11",
        ratings: { kenpom: { source: "kenpom", adjOE: 104, adjDE: 103, adjEM: 1.0 } },
        tournamentEntry: { seed: 11, region: "South", bracketPosition: 10 },
      })
    );
    // Play-in at Midwest-11 (extra)
    teams.push(
      createMockTeamSeason({
        id: "playin-mw11",
        teamId: "playin-mw11",
        ratings: { kenpom: { source: "kenpom", adjOE: 103, adjDE: 104, adjEM: -1.0 } },
        tournamentEntry: { seed: 11, region: "Midwest", bracketPosition: 10 },
      })
    );

    expect(teams).toHaveLength(68);

    const result = filterToMainBracket(teams);
    expect(result).toHaveLength(64);

    // Verify each region+seed combo appears exactly once
    const slotSet = new Set(
      result.map((t) => `${t.tournamentEntry!.region}-${t.tournamentEntry!.seed}`)
    );
    expect(slotSet.size).toBe(64);
  });

  it("returns empty array for empty input", () => {
    expect(filterToMainBracket([])).toHaveLength(0);
  });

  it("skips teams without tournament entries", () => {
    const teamWithEntry = createStrongTeam({
      id: "t1",
      teamId: "duke",
      tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
    });
    // Create a team without tournamentEntry by manually removing it
    const teamWithoutEntry = createMockTeamSeason({
      id: "t2",
      teamId: "no-entry",
    });
    // deepMerge can't set undefined, so delete it manually
    delete (teamWithoutEntry as any).tournamentEntry;

    const result = filterToMainBracket([teamWithEntry, teamWithoutEntry]);
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("duke");
  });

  it("falls back to torvik rating when kenpom is missing", () => {
    // deepMerge merges nested objects, so we must manually clear kenpom
    const teamHighTorvik = createMockTeamSeason({
      id: "high",
      teamId: "high",
      tournamentEntry: { seed: 11, region: "East", bracketPosition: 10 },
    });
    // Clear kenpom and evanmiya, set torvik directly
    teamHighTorvik.ratings = {
      torvik: { source: "torvik", adjOE: 115, adjDE: 100, adjEM: 15.0 },
    };

    const teamLowTorvik = createMockTeamSeason({
      id: "low",
      teamId: "low",
      tournamentEntry: { seed: 11, region: "East", bracketPosition: 10 },
    });
    teamLowTorvik.ratings = {
      torvik: { source: "torvik", adjOE: 105, adjDE: 105, adjEM: 0.0 },
    };

    const result = filterToMainBracket([teamLowTorvik, teamHighTorvik]);
    expect(result).toHaveLength(1);
    expect(result[0].teamId).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// resolveSlotTeam
// ---------------------------------------------------------------------------

describe("resolveSlotTeam", () => {
  it("finds a team by region-seed slot", () => {
    const duke = createStrongTeam({
      teamId: "duke",
      tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
    });
    const teams = new Map([["duke", duke]]);
    expect(resolveSlotTeam("East-1", teams)).toBe(duke);
  });

  it("returns null when slot is not found", () => {
    const duke = createStrongTeam({
      teamId: "duke",
      tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
    });
    const teams = new Map([["duke", duke]]);
    expect(resolveSlotTeam("West-1", teams)).toBeNull();
  });
});
