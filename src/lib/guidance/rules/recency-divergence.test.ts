import { describe, it, expect } from "vitest";
import { recencyDivergenceRule } from "./recency-divergence";
import { createMockTeam, createMockContext } from "../test-helpers";

describe("recencyDivergenceRule", () => {
  it("flags large positive form override for team A", () => {
    const context = createMockContext({
      matchupOverrides: {
        "R64-East-1": { recentFormA: 3.0 },
      },
    });
    const messages = recencyDivergenceRule(context);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const formMsg = messages.find((m) => m.id === "recency-form-a-R64-East-1");
    expect(formMsg).toBeDefined();
    expect(formMsg?.severity).toBe("info");
    expect(formMsg?.description).toContain("+3.0");
  });

  it("flags large negative form override for team B", () => {
    const context = createMockContext({
      matchupOverrides: {
        "R32-West-2": { recentFormB: -2.5 },
      },
    });
    const messages = recencyDivergenceRule(context);
    const formMsg = messages.find((m) => m.id === "recency-form-b-R32-West-2");
    expect(formMsg).toBeDefined();
    expect(formMsg?.description).toContain("-2.5");
  });

  it("does not flag small form overrides", () => {
    const context = createMockContext({
      matchupOverrides: {
        "R64-East-1": { recentFormA: 1.5, recentFormB: -1.0 },
      },
    });
    const messages = recencyDivergenceRule(context);
    const formMsgs = messages.filter((m) => m.id.startsWith("recency-form"));
    expect(formMsgs).toHaveLength(0);
  });

  it("flags rating source disagreement above threshold", () => {
    const team = createMockTeam({
      shortName: "Split U",
      kenpomAdjEM: 25.0,
      torvikAdjEM: 18.0,
      evanmiyaAdjEM: 20.0,
    });
    const context = createMockContext({
      teams: [team],
      picks: { "R64-East-1": team.teamId },
    });
    const messages = recencyDivergenceRule(context);
    const sourceMsg = messages.find((m) => m.id.includes("source-disagreement"));
    expect(sourceMsg).toBeDefined();
    expect(sourceMsg?.severity).toBe("warning");
    expect(sourceMsg?.description).toContain("7.0"); // 25 - 18 = 7
    expect(sourceMsg?.title).toContain("Split U");
  });

  it("does not flag when rating sources agree", () => {
    const team = createMockTeam({
      kenpomAdjEM: 20.0,
      torvikAdjEM: 19.0,
      evanmiyaAdjEM: 18.5,
    });
    const context = createMockContext({
      teams: [team],
      picks: { "R64-East-1": team.teamId },
    });
    const messages = recencyDivergenceRule(context);
    const sourceMsg = messages.find((m) => m.id.includes("source-disagreement"));
    expect(sourceMsg).toBeUndefined();
  });

  it("deduplicates source disagreement across multiple picks", () => {
    const team = createMockTeam({
      kenpomAdjEM: 25.0,
      torvikAdjEM: 18.0,
      evanmiyaAdjEM: 20.0,
    });
    const context = createMockContext({
      teams: [team],
      picks: {
        "R64-East-1": team.teamId,
        "R32-East-1": team.teamId,
      },
    });
    const messages = recencyDivergenceRule(context);
    const sourceMsgs = messages.filter((m) => m.id.includes("source-disagreement"));
    expect(sourceMsgs).toHaveLength(1);
  });
});
