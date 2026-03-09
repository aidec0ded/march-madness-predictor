import { describe, it, expect } from "vitest";
import { chalkConcentrationRule } from "./chalk-concentration";
import { createMockTeam, createMockContext } from "../test-helpers";
import type { Seed, Region } from "@/types/team";

describe("chalkConcentrationRule", () => {
  const regions: Region[] = ["East", "West", "South", "Midwest"];
  const matchups: [Seed, Seed][] = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [6, 11], [3, 14], [7, 10], [2, 15],
  ];

  /**
   * Build a bracket with a specified chalk percentage for R64 games.
   * chalkPct = 1.0 means all higher seeds win.
   */
  function buildChalkBracket(chalkPct: number) {
    const teams = [];
    const picks: Record<string, string> = {};
    const totalGames = regions.length * matchups.length; // 32
    const numChalk = Math.round(totalGames * chalkPct);
    let chalkSoFar = 0;

    for (const region of regions) {
      for (let i = 0; i < matchups.length; i++) {
        const [higher, lower] = matchups[i];
        const gameId = `R64-${region}-${i + 1}`;
        const teamA = createMockTeam({ seed: higher, region });
        const teamB = createMockTeam({ seed: lower, region });
        teams.push(teamA, teamB);

        if (chalkSoFar < numChalk) {
          picks[gameId] = teamA.teamId; // chalk (higher seed wins)
          chalkSoFar++;
        } else {
          picks[gameId] = teamB.teamId; // upset
        }
      }
    }

    return { teams, picks };
  }

  it("returns no messages when chalk rate is below 80%", () => {
    const { teams, picks } = buildChalkBracket(0.7);
    const context = createMockContext({ teams, picks });
    const messages = chalkConcentrationRule(context);
    expect(messages).toHaveLength(0);
  });

  it("returns a warning when chalk rate is >= 80%", () => {
    const { teams, picks } = buildChalkBracket(0.85);
    const context = createMockContext({ teams, picks });
    const messages = chalkConcentrationRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe("warning");
    expect(messages[0].category).toBe("chalk_concentration");
  });

  it("returns danger when chalk rate is >= 90%", () => {
    const { teams, picks } = buildChalkBracket(0.95);
    const context = createMockContext({ teams, picks });
    const messages = chalkConcentrationRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe("danger");
  });

  it("returns no messages when fewer than 4 picks exist", () => {
    const teamA = createMockTeam({ seed: 1, region: "East" });
    const teamB = createMockTeam({ seed: 16, region: "East" });
    const context = createMockContext({
      teams: [teamA, teamB],
      picks: { "R64-East-1": teamA.teamId },
    });
    const messages = chalkConcentrationRule(context);
    expect(messages).toHaveLength(0);
  });

  it("handles 100% chalk bracket", () => {
    const { teams, picks } = buildChalkBracket(1.0);
    const context = createMockContext({ teams, picks });
    const messages = chalkConcentrationRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe("danger");
    expect(messages[0].title).toContain("100%");
  });
});
