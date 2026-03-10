/**
 * Tests for the narrative prompt builder.
 *
 * Validates:
 * 1. Team data block formatting
 * 2. Full prompt structure and required sections
 * 3. Hash determinism and sensitivity
 * 4. Override context inclusion
 * 5. Pool context inclusion
 */

import { describe, it, expect } from "vitest";
import {
  buildTeamDataBlock,
  buildNarrativePrompt,
  hashNarrativeInput,
} from "./prompt-builder";
import type { NarrativeRequest, NarrativeTeamData } from "@/types/narrative";
import type { ProbabilityBreakdown } from "@/types/engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTeamData(overrides: Partial<NarrativeTeamData> = {}): NarrativeTeamData {
  return {
    name: "Duke",
    seed: 1,
    region: "East",
    conference: "ACC",
    kenpomAdjOE: 118.5,
    kenpomAdjDE: 96.2,
    kenpomAdjEM: 22.3,
    torvikAdjOE: 117.8,
    torvikAdjDE: 96.0,
    torvikAdjEM: 21.8,
    miyaBPR: 20.1,
    offEfgPct: 55.2,
    offToPct: 17.1,
    offOrbPct: 32.4,
    offFtRate: 36.8,
    defEfgPct: 46.3,
    defToPct: 21.5,
    defOrbPct: 26.1,
    defFtRate: 28.2,
    offThreePtPct: 37.2,
    offThreePtRate: 38.5,
    offFtPct: 76.1,
    defThreePtPct: 31.8,
    defThreePtRate: 33.2,
    adjTempo: 69.2,
    avgPossLengthOff: 16.8,
    avgPossLengthDef: 15.9,
    experience: 2.34,
    minutesContinuity: 0.68,
    benchMinutesPct: 0.294,
    avgHeight: 76.2,
    twoFoulParticipation: 0.72,
    coachName: "Jon Scheyer",
    coachTournamentWins: 8,
    coachTournamentGames: 12,
    coachFinalFours: 1,
    coachChampionships: 0,
    coachYearsHC: 4,
    ...overrides,
  };
}

function makeBreakdown(overrides: Partial<ProbabilityBreakdown> = {}): ProbabilityBreakdown {
  return {
    baseProbability: 0.73,
    compositeRatingA: {
      adjOE: 118.5,
      adjDE: 96.2,
      adjEM: 22.3,
      sources: [{ source: "kenpom", weight: 0.4, adjEM: 22.3 }],
    },
    compositeRatingB: {
      adjOE: 105.2,
      adjDE: 100.1,
      adjEM: 5.1,
      sources: [{ source: "kenpom", weight: 0.4, adjEM: 5.1 }],
    },
    ratingDifferential: 17.2,
    fourFactorsAdjustment: 0.025,
    experienceAdjustment: 0.012,
    continuityAdjustment: 0.005,
    coachAdjustment: 0.008,
    opponentAdjustAdjustment: 0,
    benchDepthAdjustment: 0,
    paceAdjustAdjustment: 0,
    totalMeanAdjustment: 0.05,
    overrideAdjustments: {
      injury: 0,
      siteProximity: 0,
      recentForm: 0,
      rest: 0,
      total: 0,
    },
    tempoVarianceMultiplier: 0.95,
    threePtVarianceMultiplier: 1.05,
    combinedVarianceMultiplier: 0.9975,
    finalProbability: 0.78,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<NarrativeRequest> = {}): NarrativeRequest {
  return {
    gameId: "R64-East-1",
    round: "R64",
    teamAData: makeTeamData(),
    teamBData: makeTeamData({
      name: "Vermont",
      seed: 16,
      conference: "AE",
      kenpomAdjEM: 2.1,
      kenpomAdjOE: 105.2,
      kenpomAdjDE: 103.1,
    }),
    probA: 0.93,
    spread: -12.5,
    breakdown: makeBreakdown(),
    poolSizeBucket: "medium",
    ownershipA: 97.0,
    ownershipB: 3.0,
    leverageA: 0.96,
    leverageB: 1.0,
    poolDescription:
      "Mostly chalk with 1-2 strategically contrarian picks. Balance probability with differentiation.",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildTeamDataBlock", () => {
  it("includes team name, seed, region, and conference", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("TEAM A: Duke (1 seed, East, ACC)");
  });

  it("includes efficiency ratings from all sources", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("KenPom AdjEM +22.3");
    expect(block).toContain("Torvik AdjEM +21.8");
    expect(block).toContain("Miya BPR +20.1");
  });

  it("formats negative efficiency with minus sign", () => {
    const block = buildTeamDataBlock(
      makeTeamData({ kenpomAdjEM: -3.5, kenpomAdjOE: 98.5, kenpomAdjDE: 102.0 }),
      "B"
    );
    expect(block).toContain("KenPom AdjEM -3.5");
  });

  it("includes four factors offense and defense", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("Four Factors (Off):");
    expect(block).toContain("eFG 55.2%");
    expect(block).toContain("Four Factors (Def):");
    expect(block).toContain("eFG 46.3%");
  });

  it("includes shooting splits", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("3PT 37.2% at 38.5% rate");
    expect(block).toContain("FT 76.1%");
  });

  it("includes tempo data", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("69.2 adj tempo");
    expect(block).toContain("Off poss 16.8s");
  });

  it("includes roster metrics", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("Exp 2.34 yrs");
    expect(block).toContain("Continuity 68%");
    expect(block).toContain("Bench 29.4%");
    expect(block).toContain('Height 76.2"');
  });

  it("includes coach data", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("Coach: Jon Scheyer");
    expect(block).toContain("8W/12G");
    expect(block).toContain("1 F4");
  });

  it("includes style data", () => {
    const block = buildTeamDataBlock(makeTeamData(), "A");
    expect(block).toContain("2-Foul Part 0.72");
  });

  it("omits rating sources that are undefined", () => {
    const block = buildTeamDataBlock(
      makeTeamData({
        kenpomAdjEM: undefined,
        kenpomAdjOE: undefined,
        kenpomAdjDE: undefined,
        miyaBPR: undefined,
      }),
      "A"
    );
    expect(block).not.toContain("KenPom");
    expect(block).not.toContain("Miya");
    expect(block).toContain("Torvik AdjEM +21.8");
  });
});

describe("buildNarrativePrompt", () => {
  it("returns system and userMessage", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.system).toBeDefined();
    expect(prompt.userMessage).toBeDefined();
  });

  it("system message includes data dictionary", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.system).toContain("Data Dictionary");
    expect(prompt.system).toContain("AdjEM");
  });

  it("system message includes output format instructions", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.system).toContain("## Rating Profile");
    expect(prompt.system).toContain("## Stylistic Matchup");
    expect(prompt.system).toContain("## Key Factors");
    expect(prompt.system).toContain("## How This Game Plays Out");
    expect(prompt.system).toContain("## Recommendation");
  });

  it("system message includes rules", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.system).toContain("Ground every claim");
    expect(prompt.system).toContain("under 600 words");
  });

  it("user message includes both team data blocks", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.userMessage).toContain("TEAM A: Duke");
    expect(prompt.userMessage).toContain("TEAM B: Vermont");
  });

  it("user message includes matchup context", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.userMessage).toContain("MATCHUP CONTEXT:");
    expect(prompt.userMessage).toContain("Win Probability:");
    expect(prompt.userMessage).toContain("Point Spread:");
    expect(prompt.userMessage).toContain("Variance:");
  });

  it("user message includes pool context", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.userMessage).toContain("POOL CONTEXT:");
    expect(prompt.userMessage).toContain("Pool Strategy:");
    expect(prompt.userMessage).toContain("Ownership:");
    expect(prompt.userMessage).toContain("Leverage Score:");
  });

  it("user message includes examples", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.userMessage).toContain("Example 1");
    expect(prompt.userMessage).toContain("Rating Profile");
  });

  it("user message includes round label", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.userMessage).toContain("Round of 64");
  });

  it("includes override context when overrides are present", () => {
    const prompt = buildNarrativePrompt(
      makeRequest({
        overrides: {
          injuryAdjustmentA: -3.0,
          recentFormB: 2.5,
          siteProximityA: "regional_advantage",
        },
      })
    );
    expect(prompt.userMessage).toContain("PER-MATCHUP OVERRIDES:");
    expect(prompt.userMessage).toContain("Team A injury: -3.0 eff pts");
    expect(prompt.userMessage).toContain("Team B recent form: +2.5 eff pts");
    expect(prompt.userMessage).toContain("Team A site: regional_advantage");
  });

  it("omits override section when no overrides", () => {
    const prompt = buildNarrativePrompt(makeRequest());
    expect(prompt.userMessage).not.toContain("PER-MATCHUP OVERRIDES:");
  });
});

describe("hashNarrativeInput", () => {
  it("produces a deterministic hash", () => {
    const req = makeRequest();
    const hash1 = hashNarrativeInput(req);
    const hash2 = hashNarrativeInput(req);
    expect(hash1).toBe(hash2);
  });

  it("starts with nar_ prefix", () => {
    const hash = hashNarrativeInput(makeRequest());
    expect(hash).toMatch(/^nar_/);
  });

  it("produces different hashes for different game IDs", () => {
    const hash1 = hashNarrativeInput(makeRequest({ gameId: "R64-East-1" }));
    const hash2 = hashNarrativeInput(makeRequest({ gameId: "R64-East-2" }));
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for different probabilities", () => {
    const hash1 = hashNarrativeInput(makeRequest({ probA: 0.73 }));
    const hash2 = hashNarrativeInput(makeRequest({ probA: 0.85 }));
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes for different pool sizes", () => {
    const hash1 = hashNarrativeInput(makeRequest({ poolSizeBucket: "small" }));
    const hash2 = hashNarrativeInput(makeRequest({ poolSizeBucket: "large" }));
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes when variance changes", () => {
    const hash1 = hashNarrativeInput(makeRequest());
    const hash2 = hashNarrativeInput(
      makeRequest({
        breakdown: makeBreakdown({ tempoVarianceMultiplier: 0.8 }),
      })
    );
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hashes when overrides change", () => {
    const hash1 = hashNarrativeInput(makeRequest());
    const hash2 = hashNarrativeInput(
      makeRequest({
        breakdown: makeBreakdown({
          overrideAdjustments: {
            injury: -3.0,
            siteProximity: 0,
            recentForm: 0,
            rest: 0,
            total: -3.0,
          },
        }),
      })
    );
    expect(hash1).not.toBe(hash2);
  });
});
