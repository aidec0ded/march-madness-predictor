import { describe, it, expect } from "vitest";
import { tempoExplanationRule } from "./tempo-explanation";
import { createMockTeam, createMockContext } from "../test-helpers";

describe("tempoExplanationRule", () => {
  it("flags an R64 upset involving a slow-paced winner", () => {
    // 12-seed (slow) beats 5-seed
    const winner = createMockTeam({
      shortName: "Slow U",
      seed: 12,
      region: "East",
      adjTempo: 61,
    });
    const favorite = createMockTeam({
      shortName: "Fast St",
      seed: 5,
      region: "East",
      adjTempo: 70,
    });
    const context = createMockContext({
      teams: [winner, favorite],
      picks: { "R64-East-3": winner.teamId },
    });
    const messages = tempoExplanationRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe("info");
    expect(messages[0].category).toBe("tempo_explanation");
    expect(messages[0].title).toContain("Slow U");
    expect(messages[0].description).toContain("slow pace");
  });

  it("flags when the losing favorite is slow-paced", () => {
    // 14-seed beats slow 3-seed
    const winner = createMockTeam({
      shortName: "Cinderella",
      seed: 14,
      region: "West",
      adjTempo: 68,
    });
    const favorite = createMockTeam({
      shortName: "SlowFav",
      seed: 3,
      region: "West",
      adjTempo: 62,
    });
    const context = createMockContext({
      teams: [winner, favorite],
      picks: { "R64-West-6": winner.teamId },
    });
    const messages = tempoExplanationRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].description).toContain("SlowFav");
  });

  it("flags both teams when both are slow", () => {
    const winner = createMockTeam({
      shortName: "Turtle A",
      seed: 9,
      region: "South",
      adjTempo: 61,
    });
    const favorite = createMockTeam({
      shortName: "Turtle B",
      seed: 8,
      region: "South",
      adjTempo: 63,
    });
    const context = createMockContext({
      teams: [winner, favorite],
      picks: { "R64-South-2": winner.teamId },
    });
    const messages = tempoExplanationRule(context);
    expect(messages).toHaveLength(1);
    expect(messages[0].description).toContain("Both");
  });

  it("does not flag when both teams have normal tempo", () => {
    const winner = createMockTeam({ seed: 12, region: "East", adjTempo: 68 });
    const favorite = createMockTeam({ seed: 5, region: "East", adjTempo: 70 });
    const context = createMockContext({
      teams: [winner, favorite],
      picks: { "R64-East-3": winner.teamId },
    });
    const messages = tempoExplanationRule(context);
    expect(messages).toHaveLength(0);
  });

  it("does not flag chalk picks (higher seed winning)", () => {
    const winner = createMockTeam({
      seed: 1,
      region: "East",
      adjTempo: 60,
    });
    const context = createMockContext({
      teams: [winner],
      picks: { "R64-East-1": winner.teamId },
    });
    const messages = tempoExplanationRule(context);
    expect(messages).toHaveLength(0);
  });

  it("does not flag non-R64 games", () => {
    const winner = createMockTeam({ seed: 12, region: "East", adjTempo: 60 });
    const context = createMockContext({
      teams: [winner],
      picks: { "R32-East-2": winner.teamId },
    });
    const messages = tempoExplanationRule(context);
    expect(messages).toHaveLength(0);
  });
});
