import { describe, it, expect } from "vitest";
import { leverConflictRule } from "./lever-conflict";
import { createMockTeam, createMockContext } from "../test-helpers";

describe("leverConflictRule", () => {
  it("flags low-experience team when experience weight is high", () => {
    const team = createMockTeam({
      shortName: "Freshmen U",
      experience: 1.0,
      seed: 5,
      region: "East",
    });
    const context = createMockContext({
      teams: [team],
      picks: { "S16-East-1": team.teamId },
      globalLevers: { experienceWeight: 2.0 },
    });
    const messages = leverConflictRule(context);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const expMsg = messages.find((m) => m.id.includes("experience"));
    expect(expMsg).toBeDefined();
    expect(expMsg?.severity).toBe("warning");
    expect(expMsg?.title).toContain("Freshmen U");
  });

  it("does not flag when experience weight is default (1.0)", () => {
    const team = createMockTeam({ experience: 1.0, seed: 3, region: "East" });
    const context = createMockContext({
      teams: [team],
      picks: { "S16-East-1": team.teamId },
      globalLevers: { experienceWeight: 1.0 },
    });
    const messages = leverConflictRule(context);
    const expMsg = messages.find((m) => m.id.includes("experience"));
    expect(expMsg).toBeUndefined();
  });

  it("flags low-continuity team when continuity weight is high", () => {
    const team = createMockTeam({
      shortName: "Transfer U",
      minutesContinuity: 30,
      seed: 4,
      region: "West",
    });
    const context = createMockContext({
      teams: [team],
      picks: { "E8-West": team.teamId },
      globalLevers: { continuityWeight: 1.8 },
    });
    const messages = leverConflictRule(context);
    const contMsg = messages.find((m) => m.id.includes("continuity"));
    expect(contMsg).toBeDefined();
    expect(contMsg?.title).toContain("Transfer U");
  });

  it("flags inexperienced coach when coach weight is high", () => {
    const team = createMockTeam({
      shortName: "New Coach State",
      coachTournamentGames: 1,
      coachName: "First Timer",
      seed: 3,
      region: "South",
    });
    const context = createMockContext({
      teams: [team],
      picks: { "F4-1": team.teamId },
      globalLevers: { coachExperienceWeight: 2.0 },
    });
    const messages = leverConflictRule(context);
    const coachMsg = messages.find((m) => m.id.includes("coach"));
    expect(coachMsg).toBeDefined();
    expect(coachMsg?.title).toContain("New Coach State");
    expect(coachMsg?.description).toContain("First Timer");
  });

  it("does not flag R64 or R32 games (only deep rounds)", () => {
    const team = createMockTeam({ experience: 1.0, seed: 12, region: "East" });
    const context = createMockContext({
      teams: [team],
      picks: {
        "R64-East-3": team.teamId,
        "R32-East-2": team.teamId,
      },
      globalLevers: { experienceWeight: 3.0 },
    });
    const messages = leverConflictRule(context);
    expect(messages).toHaveLength(0);
  });
});
