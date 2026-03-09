import { describe, it, expect } from "vitest";
import { varianceMismatchRule } from "./variance-mismatch";
import { createMockTeam, createMockContext } from "../test-helpers";

describe("varianceMismatchRule", () => {
  it("flags a high-3PT team picked to S16", () => {
    const team = createMockTeam({
      shortName: "3PT U",
      threePtRate: 0.42,
      seed: 5,
      region: "East",
    });
    const context = createMockContext({
      teams: [team],
      picks: { "S16-East-1": team.teamId },
    });
    const messages = varianceMismatchRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe("warning");
    expect(messages[0].category).toBe("variance_mismatch");
    expect(messages[0].title).toContain("3PT U");
    expect(messages[0].title).toContain("Sweet 16");
  });

  it("flags a high-3PT team picked to NCG", () => {
    const team = createMockTeam({
      shortName: "Boom",
      threePtRate: 0.39,
      seed: 3,
      region: "West",
    });
    const context = createMockContext({
      teams: [team],
      picks: { "NCG": team.teamId },
    });
    const messages = varianceMismatchRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].title).toContain("Championship");
  });

  it("does not flag a low-3PT team advancing deep", () => {
    const team = createMockTeam({
      shortName: "Paint U",
      threePtRate: 0.30,
      seed: 1,
      region: "South",
    });
    const context = createMockContext({
      teams: [team],
      picks: { "E8-South": team.teamId },
    });
    const messages = varianceMismatchRule(context);
    expect(messages).toHaveLength(0);
  });

  it("does not flag a high-3PT team in R64 or R32", () => {
    const team = createMockTeam({ threePtRate: 0.42, seed: 5, region: "East" });
    const context = createMockContext({
      teams: [team],
      picks: {
        "R64-East-3": team.teamId,
        "R32-East-2": team.teamId,
      },
    });
    const messages = varianceMismatchRule(context);
    expect(messages).toHaveLength(0);
  });

  it("deduplicates when the same team appears in multiple deep-round picks", () => {
    const team = createMockTeam({ threePtRate: 0.40, seed: 2, region: "Midwest" });
    const context = createMockContext({
      teams: [team],
      picks: {
        "S16-Midwest-2": team.teamId,
        "E8-Midwest": team.teamId,
        "F4-2": team.teamId,
      },
    });
    const messages = varianceMismatchRule(context);
    // Should only get one message per team, not three
    expect(messages).toHaveLength(1);
  });
});
