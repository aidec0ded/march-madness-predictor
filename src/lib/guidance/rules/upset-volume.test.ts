import { describe, it, expect } from "vitest";
import { upsetVolumeRule } from "./upset-volume";
import { createMockTeam, createMockContext } from "../test-helpers";
import type { Seed, Region } from "@/types/team";

describe("upsetVolumeRule", () => {
  const regions: Region[] = ["East", "West", "South", "Midwest"];

  /** Build R64 picks where N upsets are selected across regions */
  function buildUpsetPicks(numUpsets: number) {
    const teams = [];
    const picks: Record<string, string> = {};

    // Standard R64 matchups per region: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
    const matchups: [Seed, Seed][] = [
      [1, 16], [8, 9], [5, 12], [4, 13],
      [6, 11], [3, 14], [7, 10], [2, 15],
    ];

    let upsetsSoFar = 0;

    for (const region of regions) {
      for (let i = 0; i < matchups.length; i++) {
        const [higher, lower] = matchups[i];
        const gameId = `R64-${region}-${i + 1}`;

        const teamA = createMockTeam({ seed: higher, region });
        const teamB = createMockTeam({ seed: lower, region });
        teams.push(teamA, teamB);

        // Pick the upset (lower seed team = higher seed number)
        if (upsetsSoFar < numUpsets) {
          picks[gameId] = teamB.teamId;
          upsetsSoFar++;
        } else {
          picks[gameId] = teamA.teamId;
        }
      }
    }

    return { teams, picks };
  }

  it("returns no messages when upset count is within normal range", () => {
    const { teams, picks } = buildUpsetPicks(4);
    const context = createMockContext({ teams, picks });
    const messages = upsetVolumeRule(context);
    expect(messages).toHaveLength(0);
  });

  it("returns no messages at exactly 6 upsets (threshold boundary)", () => {
    const { teams, picks } = buildUpsetPicks(6);
    const context = createMockContext({ teams, picks });
    const messages = upsetVolumeRule(context);
    expect(messages).toHaveLength(0);
  });

  it("returns a warning when upset count exceeds 6", () => {
    const { teams, picks } = buildUpsetPicks(7);
    const context = createMockContext({ teams, picks });
    const messages = upsetVolumeRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe("warning");
    expect(messages[0].category).toBe("upset_volume");
    expect(messages[0].title).toContain("7");
  });

  it("returns danger when upset count reaches 8+", () => {
    const { teams, picks } = buildUpsetPicks(9);
    const context = createMockContext({ teams, picks });
    const messages = upsetVolumeRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe("danger");
  });

  it("returns no messages when picks are empty", () => {
    const context = createMockContext({});
    const messages = upsetVolumeRule(context);
    expect(messages).toHaveLength(0);
  });

  it("ignores non-R64 games", () => {
    const team = createMockTeam({ seed: 12, region: "East" });
    const context = createMockContext({
      teams: [team],
      picks: { "R32-East-1": team.teamId },
    });
    const messages = upsetVolumeRule(context);
    expect(messages).toHaveLength(0);
  });
});
