/**
 * Tests for the KenPom data normalizer.
 */

import { describe, it, expect } from "vitest";
import { normalizeKenPom } from "./kenpom";
import type { KenPomRawRow } from "@/types";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/**
 * Creates a complete, valid KenPom raw row with realistic data.
 * Specific fields can be overridden via the `overrides` parameter.
 */
function makeKenPomRow(overrides: Partial<KenPomRawRow> = {}): KenPomRawRow {
  return {
    Team: "Connecticut",
    Conf: "Big East",
    AdjEM: "31.4",
    AdjO: "121.1",
    AdjD: "89.7",
    AdjT: "67.8",
    "OE-eFG%": "55.2",
    "OE-TO%": "16.3",
    "OE-OR%": "34.1",
    "OE-FTR": "36.8",
    "DE-eFG%": "44.1",
    "DE-TO%": "21.5",
    "DE-OR%": "24.3",
    "DE-FTR": "28.9",
    "3P%": "36.5",
    "3PA/FGA": "38.2",
    "FT%": "73.5",
    "Opp3P%": "30.1",
    "Opp3PA/FGA": "33.4",
    "OppFT%": "68.2",
    AvgPossOff: "16.8",
    AvgPossDef: "17.2",
    "BenchMin%": "28.5",
    Experience: "2.15",
    Continuity: "62.3",
    AvgHgt: "78.2",
    "2FoulPart": "45.6",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalizeKenPom", () => {
  it("should correctly map a valid KenPom row to the TeamSeason schema", () => {
    const row = makeKenPomRow();
    const { data, errors } = normalizeKenPom([row], 2025);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);

    const team = data[0];

    // Team identity
    expect(team.team?.name).toBe("Connecticut");
    expect(team.team?.conference).toBe("Big East");
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
    expect(team.avgPossLengthOff).toBe(16.8);
    expect(team.avgPossLengthDef).toBe(17.2);

    // Roster
    expect(team.benchMinutesPct).toBe(28.5);
    expect(team.experience).toBe(2.15);
    expect(team.minutesContinuity).toBe(62.3);
    expect(team.avgHeight).toBe(78.2);

    // Style
    expect(team.twoFoulParticipation).toBe(45.6);
  });

  it("should produce validation errors for invalid numeric values", () => {
    const row = makeKenPomRow({
      AdjO: "not_a_number",
      AdjD: "also_bad",
      AdjEM: "",
    });
    const { data, errors } = normalizeKenPom([row], 2025);

    // Should still produce a record, but without efficiency ratings
    expect(data).toHaveLength(1);
    expect(data[0].ratings?.kenpom).toBeUndefined();

    // Should have 3 errors for the invalid fields
    expect(errors).toHaveLength(3);
    expect(errors[0].field).toBe("AdjO");
    expect(errors[0].row).toBe(0);
    expect(errors[1].field).toBe("AdjD");
    expect(errors[2].field).toBe("AdjEM");
  });

  it("should handle missing optional fields gracefully", () => {
    const row = makeKenPomRow({
      AvgPossOff: "",
      AvgPossDef: "",
      "BenchMin%": "",
      Experience: "",
      Continuity: "",
      AvgHgt: "",
      "2FoulPart": "",
    });
    const { data, errors } = normalizeKenPom([row], 2025);

    // No errors for optional fields
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);

    // Optional fields should be undefined (not set)
    const team = data[0];
    expect(team.avgPossLengthOff).toBeUndefined();
    expect(team.avgPossLengthDef).toBeUndefined();
    expect(team.benchMinutesPct).toBeUndefined();
    expect(team.experience).toBeUndefined();
    expect(team.minutesContinuity).toBeUndefined();
    expect(team.avgHeight).toBeUndefined();
    expect(team.twoFoulParticipation).toBeUndefined();
  });

  it("should handle multiple rows and index errors correctly", () => {
    const rows = [
      makeKenPomRow({ Team: "Duke" }),
      makeKenPomRow({ Team: "UConn", AdjT: "bad_value" }),
      makeKenPomRow({ Team: "Kansas" }),
    ];
    const { data, errors } = normalizeKenPom(rows, 2025);

    expect(data).toHaveLength(3);
    expect(data[0].team?.name).toBe("Duke");
    expect(data[1].team?.name).toBe("UConn");
    expect(data[2].team?.name).toBe("Kansas");

    // Only one error, on row index 1
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(1);
    expect(errors[0].field).toBe("AdjT");
  });

  it("should return empty arrays for empty input", () => {
    const { data, errors } = normalizeKenPom([], 2025);
    expect(data).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("should handle a row where only some Four Factor fields are invalid", () => {
    const row = makeKenPomRow({
      "OE-eFG%": "abc",
      // Other offense factors remain valid
    });
    const { data, errors } = normalizeKenPom([row], 2025);

    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("OE-eFG%");

    // fourFactorsOffense should be undefined because not all fields parsed
    expect(data[0].fourFactorsOffense).toBeUndefined();

    // But fourFactorsDefense should still be present
    expect(data[0].fourFactorsDefense).toBeDefined();
  });

  it("should trim team name and conference whitespace", () => {
    const row = makeKenPomRow({
      Team: "  Duke  ",
      Conf: "  ACC  ",
    });
    const { data } = normalizeKenPom([row], 2025);

    expect(data[0].team?.name).toBe("Duke");
    expect(data[0].team?.conference).toBe("ACC");
  });
});
