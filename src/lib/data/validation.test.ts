/**
 * Tests for the data validation module.
 */

import { describe, it, expect } from "vitest";
import { validateTeamSeason, validateBatch } from "./validation";
import type { TeamSeason } from "@/types";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/**
 * Creates a valid partial TeamSeason with all numeric fields in range.
 * Can be selectively overridden for specific test cases.
 */
function makeValidPartial(
  overrides: Partial<TeamSeason> = {}
): Partial<TeamSeason> {
  return {
    ratings: {
      kenpom: {
        source: "kenpom",
        adjOE: 115.0,
        adjDE: 95.0,
        adjEM: 20.0,
      },
    },
    fourFactorsOffense: {
      efgPct: 52.5,
      toPct: 17.0,
      orbPct: 30.0,
      ftRate: 35.0,
    },
    fourFactorsDefense: {
      efgPct: 47.0,
      toPct: 20.0,
      orbPct: 27.0,
      ftRate: 30.0,
    },
    shootingOffense: {
      threePtPct: 35.0,
      threePtRate: 37.0,
      ftPct: 74.0,
    },
    shootingDefense: {
      threePtPct: 32.0,
      threePtRate: 34.0,
      ftPct: 70.0,
    },
    adjTempo: 68.0,
    avgPossLengthOff: 16.5,
    avgPossLengthDef: 17.0,
    benchMinutesPct: 25.0,
    experience: 2.0,
    minutesContinuity: 60.0,
    avgHeight: 77.0,
    twoFoulParticipation: 40.0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: validateTeamSeason
// ---------------------------------------------------------------------------

describe("validateTeamSeason", () => {
  // -----------------------------------------------------------------------
  // Valid data
  // -----------------------------------------------------------------------

  it("should pass validation for a complete, in-range TeamSeason partial", () => {
    const team = makeValidPartial();
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validRowCount).toBe(1);
    expect(result.totalRowCount).toBe(1);
  });

  it("should pass validation for an empty partial (no fields to validate)", () => {
    const result = validateTeamSeason({});

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should pass validation when only some fields are present", () => {
    const team: Partial<TeamSeason> = {
      adjTempo: 68.0,
      experience: 2.0,
    };
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Out-of-range efficiency ratings
  // -----------------------------------------------------------------------

  it("should flag out-of-range adjOE (too high)", () => {
    const team = makeValidPartial({
      ratings: {
        kenpom: {
          source: "kenpom",
          adjOE: 160.0, // Max is 140
          adjDE: 95.0,
          adjEM: 65.0,
        },
      },
    });
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);

    const adjOEError = result.errors.find(
      (e) => e.field === "ratings.kenpom.adjOE"
    );
    expect(adjOEError).toBeDefined();
    expect(adjOEError?.value).toBe(160.0);
  });

  it("should flag out-of-range adjDE (too low)", () => {
    const team = makeValidPartial({
      ratings: {
        kenpom: {
          source: "kenpom",
          adjOE: 115.0,
          adjDE: 60.0, // Min is 75
          adjEM: 55.0,
        },
      },
    });
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    const adjDEError = result.errors.find(
      (e) => e.field === "ratings.kenpom.adjDE"
    );
    expect(adjDEError).toBeDefined();
  });

  it("should flag out-of-range adjEM (too extreme)", () => {
    const team = makeValidPartial({
      ratings: {
        kenpom: {
          source: "kenpom",
          adjOE: 115.0,
          adjDE: 95.0,
          adjEM: 60.0, // Max is 50
        },
      },
    });
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    const adjEMError = result.errors.find(
      (e) => e.field === "ratings.kenpom.adjEM"
    );
    expect(adjEMError).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Out-of-range tempo
  // -----------------------------------------------------------------------

  it("should flag out-of-range adjTempo", () => {
    const team = makeValidPartial({ adjTempo: 90.0 }); // Max is 80
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    const tempoError = result.errors.find((e) => e.field === "adjTempo");
    expect(tempoError).toBeDefined();
    expect(tempoError?.message).toContain("outside expected range");
  });

  // -----------------------------------------------------------------------
  // Out-of-range experience
  // -----------------------------------------------------------------------

  it("should flag experience above 4.0", () => {
    const team = makeValidPartial({ experience: 5.0 }); // Max is 4
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    const expError = result.errors.find((e) => e.field === "experience");
    expect(expError).toBeDefined();
  });

  it("should flag negative experience", () => {
    const team = makeValidPartial({ experience: -1.0 }); // Min is 0
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    const expError = result.errors.find((e) => e.field === "experience");
    expect(expError).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Out-of-range height
  // -----------------------------------------------------------------------

  it("should flag avgHeight outside 70-84 range", () => {
    const team = makeValidPartial({ avgHeight: 65.0 }); // Min is 70
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    const heightError = result.errors.find((e) => e.field === "avgHeight");
    expect(heightError).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Boundary values
  // -----------------------------------------------------------------------

  it("should pass at the exact minimum boundary for adjOE", () => {
    const team = makeValidPartial({
      ratings: {
        kenpom: {
          source: "kenpom",
          adjOE: 75.0, // Exact minimum
          adjDE: 75.0,
          adjEM: 0.0,
        },
      },
    });
    const result = validateTeamSeason(team);

    // adjOE and adjDE at boundary should pass
    const adjOEErrors = result.errors.filter(
      (e) => e.field === "ratings.kenpom.adjOE"
    );
    const adjDEErrors = result.errors.filter(
      (e) => e.field === "ratings.kenpom.adjDE"
    );
    expect(adjOEErrors).toHaveLength(0);
    expect(adjDEErrors).toHaveLength(0);
  });

  it("should pass at the exact maximum boundary for adjOE", () => {
    const team = makeValidPartial({
      ratings: {
        kenpom: {
          source: "kenpom",
          adjOE: 140.0, // Exact maximum
          adjDE: 140.0,
          adjEM: 0.0,
        },
      },
    });
    const result = validateTeamSeason(team);

    const adjOEErrors = result.errors.filter(
      (e) => e.field === "ratings.kenpom.adjOE"
    );
    const adjDEErrors = result.errors.filter(
      (e) => e.field === "ratings.kenpom.adjDE"
    );
    expect(adjOEErrors).toHaveLength(0);
    expect(adjDEErrors).toHaveLength(0);
  });

  it("should pass at experience boundary of 0", () => {
    const team = makeValidPartial({ experience: 0 });
    const result = validateTeamSeason(team);
    const expErrors = result.errors.filter((e) => e.field === "experience");
    expect(expErrors).toHaveLength(0);
  });

  it("should pass at experience boundary of 4", () => {
    const team = makeValidPartial({ experience: 4 });
    const result = validateTeamSeason(team);
    const expErrors = result.errors.filter((e) => e.field === "experience");
    expect(expErrors).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Multiple errors
  // -----------------------------------------------------------------------

  it("should accumulate multiple errors across different fields", () => {
    const team = makeValidPartial({
      adjTempo: 999,
      experience: -5,
      avgHeight: 50,
      twoFoulParticipation: 200,
    });
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(4);

    const errorFields = result.errors.map((e) => e.field);
    expect(errorFields).toContain("adjTempo");
    expect(errorFields).toContain("experience");
    expect(errorFields).toContain("avgHeight");
    expect(errorFields).toContain("twoFoulParticipation");
  });

  // -----------------------------------------------------------------------
  // Multiple data sources
  // -----------------------------------------------------------------------

  it("should validate efficiency ratings from all three sources", () => {
    const team = makeValidPartial({
      ratings: {
        kenpom: { source: "kenpom", adjOE: 115, adjDE: 95, adjEM: 20 },
        torvik: { source: "torvik", adjOE: 200, adjDE: 95, adjEM: 105 }, // bad
        evanmiya: { source: "evanmiya", adjOE: 114, adjDE: 96, adjEM: 18 },
      },
    });
    const result = validateTeamSeason(team);

    expect(result.valid).toBe(false);
    const torvikErrors = result.errors.filter((e) =>
      e.field.startsWith("ratings.torvik")
    );
    expect(torvikErrors.length).toBeGreaterThanOrEqual(1);

    // KenPom and Evan Miya should have no errors
    const kenpomErrors = result.errors.filter((e) =>
      e.field.startsWith("ratings.kenpom")
    );
    const evanmiyaErrors = result.errors.filter((e) =>
      e.field.startsWith("ratings.evanmiya")
    );
    expect(kenpomErrors).toHaveLength(0);
    expect(evanmiyaErrors).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Row index parameter
  // -----------------------------------------------------------------------

  it("should include the provided row index in errors", () => {
    const team = makeValidPartial({ adjTempo: 999 });
    const result = validateTeamSeason(team, 42);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateBatch
// ---------------------------------------------------------------------------

describe("validateBatch", () => {
  it("should validate a batch of records and aggregate results", () => {
    const teams = [
      makeValidPartial(), // valid
      makeValidPartial({ adjTempo: 999 }), // invalid
      makeValidPartial(), // valid
    ];
    const result = validateBatch(teams);

    expect(result.valid).toBe(false);
    expect(result.totalRowCount).toBe(3);
    expect(result.validRowCount).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(1);
  });

  it("should return valid for an all-valid batch", () => {
    const teams = [makeValidPartial(), makeValidPartial()];
    const result = validateBatch(teams);

    expect(result.valid).toBe(true);
    expect(result.validRowCount).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle empty batch", () => {
    const result = validateBatch([]);

    expect(result.valid).toBe(true);
    expect(result.totalRowCount).toBe(0);
    expect(result.validRowCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
