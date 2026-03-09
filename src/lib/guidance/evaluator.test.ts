import { describe, it, expect } from "vitest";
import { evaluateGuidance } from "./evaluator";
import { createMockTeam, createMockContext } from "./test-helpers";
import type { Seed, Region } from "@/types/team";

describe("evaluateGuidance", () => {
  it("returns an empty array when there are no picks", () => {
    const context = createMockContext({});
    const messages = evaluateGuidance(context);
    expect(messages).toEqual([]);
  });

  it("sorts messages by severity: danger > warning > info", () => {
    // Build a context that triggers multiple severity levels:
    // - Many upsets -> danger (upset_volume)
    // - Large form override -> info (recency_divergence)

    const regions: Region[] = ["East", "West", "South", "Midwest"];
    const matchups: [Seed, Seed][] = [
      [1, 16], [8, 9], [5, 12], [4, 13],
      [6, 11], [3, 14], [7, 10], [2, 15],
    ];

    const teams = [];
    const picks: Record<string, string> = {};
    let upsets = 0;

    for (const region of regions) {
      for (let i = 0; i < matchups.length; i++) {
        const [higher, lower] = matchups[i];
        const teamA = createMockTeam({ seed: higher, region });
        const teamB = createMockTeam({ seed: lower, region });
        teams.push(teamA, teamB);

        // Pick 9 upsets to get danger severity
        if (upsets < 9) {
          picks[`R64-${region}-${i + 1}`] = teamB.teamId;
          upsets++;
        } else {
          picks[`R64-${region}-${i + 1}`] = teamA.teamId;
        }
      }
    }

    const context = createMockContext({
      teams,
      picks,
      matchupOverrides: {
        "R64-East-1": { recentFormA: 4.0 }, // triggers info message
      },
    });

    const messages = evaluateGuidance(context);
    expect(messages.length).toBeGreaterThan(0);

    // Verify severity ordering
    for (let i = 1; i < messages.length; i++) {
      const severityOrder = { danger: 0, warning: 1, info: 2 };
      expect(severityOrder[messages[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[messages[i - 1].severity]
      );
    }
  });

  it("deduplicates messages by ID", () => {
    // The same team in multiple deep-round picks should only generate one variance message
    const team = createMockTeam({
      threePtRate: 0.42,
      seed: 3,
      region: "East",
    });
    const context = createMockContext({
      teams: [team],
      picks: {
        "S16-East-1": team.teamId,
        "E8-East": team.teamId,
      },
    });

    const messages = evaluateGuidance(context);
    const varianceMsgs = messages.filter(
      (m) => m.category === "variance_mismatch"
    );
    expect(varianceMsgs).toHaveLength(1);
  });

  it("does not crash on malformed picks", () => {
    const context = createMockContext({
      picks: { "INVALID": "nonexistent-team" },
    });
    // Should not throw
    const messages = evaluateGuidance(context);
    expect(Array.isArray(messages)).toBe(true);
  });
});
