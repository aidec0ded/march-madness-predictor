/**
 * Tests for the KenPom data normalizer.
 */

import { describe, it, expect } from "vitest";
import { normalizeKenPom } from "./kenpom";
import type { KenPomMergedRow } from "@/types";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/**
 * Creates a complete, valid KenPomMergedRow with realistic data.
 * Specific fields can be overridden via the `overrides` parameter.
 */
function makeMergedRow(
  overrides: Partial<KenPomMergedRow> = {}
): KenPomMergedRow {
  return {
    teamName: "Connecticut",
    // Main CSV
    adjOE: 121.1,
    adjDE: 89.7,
    adjEM: 31.4,
    adjTempo: 67.8,
    seed: "1",
    // Offense CSV
    offEfgPct: 55.2,
    offToPct: 16.3,
    offOrbPct: 34.1,
    offFtRate: 36.8,
    // Defense CSV
    defEfgPct: 44.1,
    defToPct: 21.5,
    defOrbPct: 24.3,
    defFtRate: 28.9,
    // Misc CSV
    offThreePtPct: 36.5,
    offFtPct: 73.5,
    offThreePtRate: 38.2,
    defThreePtPct: 30.1,
    defFtPct: 68.2,
    defThreePtRate: 33.4,
    twoFoulParticipation: 45.6,
    // Height CSV
    avgHeight: 78.2,
    experience: 2.15,
    benchMinutesPct: 28.5,
    minutesContinuity: 62.3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalizeKenPom", () => {
  it("should correctly map all fields from KenPomMergedRow to the TeamSeason schema", () => {
    const row = makeMergedRow();
    const { data, errors } = normalizeKenPom([row], 2025);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);

    const team = data[0];

    // Team identity
    expect(team.team?.name).toBe("Connecticut");
    expect(team.team?.shortName).toBe("Connecticut");
    expect(team.season).toBe(2025);
    expect(team.dataSources).toEqual(["kenpom"]);

    // Efficiency ratings
    expect(team.ratings?.kenpom).toBeDefined();
    expect(team.ratings?.kenpom?.source).toBe("kenpom");
    expect(team.ratings?.kenpom?.adjOE).toBe(121.1);
    expect(team.ratings?.kenpom?.adjDE).toBe(89.7);
    expect(team.ratings?.kenpom?.adjEM).toBe(31.4);

    // Four Factors (offense)
    expect(team.fourFactorsOffense).toEqual({
      efgPct: 55.2,
      toPct: 16.3,
      orbPct: 34.1,
      ftRate: 36.8,
    });

    // Four Factors (defense)
    expect(team.fourFactorsDefense).toEqual({
      efgPct: 44.1,
      toPct: 21.5,
      orbPct: 24.3,
      ftRate: 28.9,
    });

    // Shooting splits (offense)
    expect(team.shootingOffense).toEqual({
      threePtPct: 36.5,
      threePtRate: 38.2,
      ftPct: 73.5,
    });

    // Shooting splits (defense)
    expect(team.shootingDefense).toEqual({
      threePtPct: 30.1,
      threePtRate: 33.4,
      ftPct: 68.2,
    });

    // Tempo
    expect(team.adjTempo).toBe(67.8);

    // Roster
    expect(team.benchMinutesPct).toBe(28.5);
    expect(team.experience).toBe(2.15);
    expect(team.minutesContinuity).toBe(62.3);
    expect(team.avgHeight).toBe(78.2);

    // Style
    expect(team.twoFoulParticipation).toBe(45.6);
  });

  it("should produce validation errors for missing required efficiency fields", () => {
    const row = makeMergedRow({
      adjOE: null,
      adjDE: null,
      adjEM: null,
    });
    const { data, errors } = normalizeKenPom([row], 2025);

    // Should still produce a record, but without efficiency ratings
    expect(data).toHaveLength(1);
    expect(data[0].ratings?.kenpom).toBeUndefined();

    // Should have 3 errors for the missing required fields
    expect(errors).toHaveLength(3);
    expect(errors[0].field).toBe("adjOE");
    expect(errors[0].row).toBe(0);
    expect(errors[1].field).toBe("adjDE");
    expect(errors[2].field).toBe("adjEM");
  });

  it("should handle missing optional fields (null values) — sub-objects not created", () => {
    const row = makeMergedRow({
      // Null out all optional fields
      offEfgPct: null,
      offToPct: null,
      offOrbPct: null,
      offFtRate: null,
      defEfgPct: null,
      defToPct: null,
      defOrbPct: null,
      defFtRate: null,
      offThreePtPct: null,
      offFtPct: null,
      offThreePtRate: null,
      defThreePtPct: null,
      defFtPct: null,
      defThreePtRate: null,
      twoFoulParticipation: null,
      avgHeight: null,
      experience: null,
      benchMinutesPct: null,
      minutesContinuity: null,
      adjTempo: null,
    });
    const { data, errors } = normalizeKenPom([row], 2025);

    // No errors for optional fields
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);

    const team = data[0];

    // Required efficiency fields are still present
    expect(team.ratings?.kenpom).toBeDefined();

    // Optional group sub-objects should be undefined (not set)
    expect(team.fourFactorsOffense).toBeUndefined();
    expect(team.fourFactorsDefense).toBeUndefined();
    expect(team.shootingOffense).toBeUndefined();
    expect(team.shootingDefense).toBeUndefined();

    // Optional scalar fields should be undefined
    expect(team.adjTempo).toBeUndefined();
    expect(team.benchMinutesPct).toBeUndefined();
    expect(team.experience).toBeUndefined();
    expect(team.minutesContinuity).toBeUndefined();
    expect(team.avgHeight).toBeUndefined();
    expect(team.twoFoulParticipation).toBeUndefined();
  });

  it("should handle multiple rows and index errors correctly", () => {
    const rows = [
      makeMergedRow({ teamName: "Duke" }),
      makeMergedRow({ teamName: "UConn", adjOE: null }),
      makeMergedRow({ teamName: "Kansas" }),
    ];
    const { data, errors } = normalizeKenPom(rows, 2025);

    expect(data).toHaveLength(3);
    expect(data[0].team?.name).toBe("Duke");
    expect(data[1].team?.name).toBe("UConn");
    expect(data[2].team?.name).toBe("Kansas");

    // Only one error, on row index 1
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(1);
    expect(errors[0].field).toBe("adjOE");
  });

  it("should return empty arrays for empty input", () => {
    const { data, errors } = normalizeKenPom([], 2025);
    expect(data).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("should preserve team name in output", () => {
    const row = makeMergedRow({ teamName: "North Carolina" });
    const { data } = normalizeKenPom([row], 2025);

    expect(data[0].team?.name).toBe("North Carolina");
    expect(data[0].team?.shortName).toBe("North Carolina");
  });

  it("should not create fourFactorsOffense when one sub-field is null", () => {
    const row = makeMergedRow({
      offEfgPct: null,
      // Other offense factors remain non-null
    });
    const { data, errors } = normalizeKenPom([row], 2025);

    // No validation errors (offense four factors are optional)
    expect(errors).toHaveLength(0);

    // fourFactorsOffense should be undefined because not all fields are present
    expect(data[0].fourFactorsOffense).toBeUndefined();

    // But fourFactorsDefense should still be present (all fields non-null)
    expect(data[0].fourFactorsDefense).toBeDefined();
  });
});
