import { describe, it, expect } from "vitest";
import { ordinal, computeFieldRankings, getTeamRank } from "./rankings";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// ordinal()
// ---------------------------------------------------------------------------

describe("ordinal", () => {
  it("returns correct suffixes for 1st, 2nd, 3rd", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
  });

  it("returns 'th' for 4-20", () => {
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(20)).toBe("20th");
  });

  it("handles 21st, 22nd, 23rd", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
  });

  it("handles larger numbers", () => {
    expect(ordinal(64)).toBe("64th");
    expect(ordinal(101)).toBe("101st");
    expect(ordinal(111)).toBe("111th");
    expect(ordinal(112)).toBe("112th");
  });
});

// ---------------------------------------------------------------------------
// Test helpers — minimal TeamSeason factory
// ---------------------------------------------------------------------------

function makeTeam(overrides: {
  teamId: string;
  adjOE?: number;
  adjDE?: number;
  efgPctOff?: number;
  adjTempo?: number;
}): TeamSeason {
  return {
    id: overrides.teamId,
    teamId: overrides.teamId,
    season: 2025,
    team: {
      id: overrides.teamId,
      name: overrides.teamId,
      shortName: overrides.teamId,
      conference: "Big Ten",
      campus: { city: "Test", state: "TS", latitude: 0, longitude: 0 },
    },
    ratings: {
      kenpom: {
        source: "kenpom",
        adjOE: overrides.adjOE ?? 100,
        adjDE: overrides.adjDE ?? 100,
        adjEM: (overrides.adjOE ?? 100) - (overrides.adjDE ?? 100),
      },
    },
    fourFactorsOffense: {
      efgPct: overrides.efgPctOff ?? 0.5,
      toPct: 0.18,
      orbPct: 0.3,
      ftRate: 0.35,
    },
    fourFactorsDefense: {
      efgPct: 0.48,
      toPct: 0.2,
      orbPct: 0.28,
      ftRate: 0.33,
    },
    shootingOffense: { threePtPct: 0.35, threePtRate: 0.38, ftPct: 0.75 },
    shootingDefense: { threePtPct: 0.33, threePtRate: 0.36, ftPct: 0.72 },
    adjTempo: overrides.adjTempo ?? 68,
    avgPossLengthOff: 16.5,
    avgPossLengthDef: 17.0,
    benchMinutesPct: 0.3,
    experience: 2.1,
    minutesContinuity: 0.55,
    avgHeight: 77.5,
    twoFoulParticipation: 0.4,
    evanmiyaOpponentAdjust: 0,
    evanmiyaPaceAdjust: 0,
    evanmiyaKillShotsPerGame: 0,
    evanmiyaKillShotsAllowedPerGame: 0,
    evanmiyaKillShotsMargin: 0,
    coach: {
      name: "Coach",
      tournamentGames: 10,
      tournamentWins: 5,
      finalFours: 1,
      championships: 0,
      yearsHeadCoach: 8,
    },
    updatedAt: "2025-03-01",
    dataSources: ["kenpom"],
  };
}

// ---------------------------------------------------------------------------
// computeFieldRankings()
// ---------------------------------------------------------------------------

describe("computeFieldRankings", () => {
  const teamA = makeTeam({ teamId: "A", adjOE: 120, adjDE: 95, efgPctOff: 0.55, adjTempo: 70 });
  const teamB = makeTeam({ teamId: "B", adjOE: 115, adjDE: 90, efgPctOff: 0.52, adjTempo: 65 });
  const teamC = makeTeam({ teamId: "C", adjOE: 110, adjDE: 100, efgPctOff: 0.58, adjTempo: 72 });

  const teams = new Map([
    ["A", teamA],
    ["B", teamB],
    ["C", teamC],
  ]);

  const rankings = computeFieldRankings(teams);

  it("ranks highest adjOE as 1st", () => {
    expect(getTeamRank(rankings, "A", "Adj. Off. Efficiency")).toBe(1);
    expect(getTeamRank(rankings, "B", "Adj. Off. Efficiency")).toBe(2);
    expect(getTeamRank(rankings, "C", "Adj. Off. Efficiency")).toBe(3);
  });

  it("ranks lowest adjDE as 1st (lower is better)", () => {
    expect(getTeamRank(rankings, "B", "Adj. Def. Efficiency")).toBe(1);
    expect(getTeamRank(rankings, "A", "Adj. Def. Efficiency")).toBe(2);
    expect(getTeamRank(rankings, "C", "Adj. Def. Efficiency")).toBe(3);
  });

  it("ranks eFG% (Off) correctly", () => {
    expect(getTeamRank(rankings, "C", "eFG% (Off)")).toBe(1);
    expect(getTeamRank(rankings, "A", "eFG% (Off)")).toBe(2);
    expect(getTeamRank(rankings, "B", "eFG% (Off)")).toBe(3);
  });

  it("ranks Adj Tempo correctly", () => {
    expect(getTeamRank(rankings, "C", "Adj Tempo")).toBe(1);
    expect(getTeamRank(rankings, "A", "Adj Tempo")).toBe(2);
    expect(getTeamRank(rankings, "B", "Adj Tempo")).toBe(3);
  });

  it("returns null for unknown team", () => {
    expect(getTeamRank(rankings, "UNKNOWN", "Adj Tempo")).toBeNull();
  });

  it("returns null for unknown stat", () => {
    expect(getTeamRank(rankings, "A", "Nonexistent Stat")).toBeNull();
  });
});

describe("computeFieldRankings — ties", () => {
  it("gives same rank to tied values", () => {
    const team1 = makeTeam({ teamId: "T1", adjOE: 110 });
    const team2 = makeTeam({ teamId: "T2", adjOE: 110 });
    const team3 = makeTeam({ teamId: "T3", adjOE: 105 });

    const rankings = computeFieldRankings([team1, team2, team3]);

    expect(getTeamRank(rankings, "T1", "Adj. Off. Efficiency")).toBe(1);
    expect(getTeamRank(rankings, "T2", "Adj. Off. Efficiency")).toBe(1);
    // After two tied at 1st, the next is 3rd (standard competition ranking)
    expect(getTeamRank(rankings, "T3", "Adj. Off. Efficiency")).toBe(3);
  });
});

describe("computeFieldRankings — accepts array", () => {
  it("works with an array of teams", () => {
    const teams = [
      makeTeam({ teamId: "X", adjOE: 115 }),
      makeTeam({ teamId: "Y", adjOE: 120 }),
    ];

    const rankings = computeFieldRankings(teams);
    expect(getTeamRank(rankings, "Y", "Adj. Off. Efficiency")).toBe(1);
    expect(getTeamRank(rankings, "X", "Adj. Off. Efficiency")).toBe(2);
  });
});
