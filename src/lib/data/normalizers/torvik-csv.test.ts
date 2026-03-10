/**
 * Tests for the Torvik Teams Table CSV normalizer.
 */

import { describe, it, expect } from "vitest";
import { normalizeTorvikCsv } from "./torvik";
import type { TorvikCsvRow } from "@/types";

function makeCsvRow(overrides: Partial<TorvikCsvRow> = {}): TorvikCsvRow {
  return {
    TEAM: "Duke",
    "ADJ OE": "120.5",
    "ADJ DE": "95.3",
    BARTHAG: "0.9456",
    RECORD: "28-5",
    WINS: "28",
    GAMES: "33",
    EFG: "54.2",
    "EFG D.": "46.8",
    "FT RATE": "32.1",
    "FT RATE D": "28.5",
    "TOV%": "16.3",
    "TOV% D": "20.1",
    "O REB%": "31.4",
    "OP REB%": "",
    "OP OREB%": "25.6",
    "RAW T": "68.5",
    "2P %": "52.3",
    "2P % D.": "44.1",
    "3P %": "36.2",
    "3P % D.": "31.5",
    "BLK%": "10.2",
    "BLKED %": "7.8",
    "AST %": "55.3",
    "OP AST %": "48.9",
    "3P RATE": "38.4",
    "3P RATE D": "35.2",
    "ADJ. T": "69.8",
    "AVG HGT.": "77.5",
    "EFF HGT.": "78.1",
    EXP: "2.15",
    YEAR: "2025",
    PAKE: "12.3",
    PASE: "11.8",
    TALENT: "25.6",
    "FT%": "74.3",
    "OP.FT%": "68.9",
    "PPP OFF.": "1.15",
    "PPP DEF.": "0.92",
    "ELITE SOS": "8.5",
    ...overrides,
  };
}

describe("normalizeTorvikCsv", () => {
  it("normalizes a valid row with all fields", () => {
    const { data, errors } = normalizeTorvikCsv([makeCsvRow()], 2025);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);

    const team = data[0];
    expect(team.season).toBe(2025);
    expect(team.dataSources).toEqual(["torvik"]);
    expect(team.team?.name).toBe("Duke");

    // Efficiency ratings
    expect(team.ratings?.torvik?.adjOE).toBe(120.5);
    expect(team.ratings?.torvik?.adjDE).toBe(95.3);
    expect(team.ratings?.torvik?.adjEM).toBeCloseTo(25.2, 1);

    // Four Factors offense
    expect(team.fourFactorsOffense?.efgPct).toBe(54.2);
    expect(team.fourFactorsOffense?.toPct).toBe(16.3);
    expect(team.fourFactorsOffense?.orbPct).toBe(31.4);
    expect(team.fourFactorsOffense?.ftRate).toBe(32.1);

    // Four Factors defense
    expect(team.fourFactorsDefense?.efgPct).toBe(46.8);
    expect(team.fourFactorsDefense?.toPct).toBe(20.1);
    expect(team.fourFactorsDefense?.orbPct).toBe(25.6);
    expect(team.fourFactorsDefense?.ftRate).toBe(28.5);

    // Shooting offense
    expect(team.shootingOffense?.threePtPct).toBe(36.2);
    expect(team.shootingOffense?.threePtRate).toBe(38.4);
    expect(team.shootingOffense?.ftPct).toBe(74.3);

    // Shooting defense
    expect(team.shootingDefense?.threePtPct).toBe(31.5);
    expect(team.shootingDefense?.threePtRate).toBe(35.2);
    expect(team.shootingDefense?.ftPct).toBe(68.9);

    // Tempo
    expect(team.adjTempo).toBe(69.8);

    // Height & Experience (Teams Table only)
    expect(team.avgHeight).toBe(77.5);
    expect(team.experience).toBe(2.15);
  });

  it("handles missing optional fields gracefully", () => {
    const row = makeCsvRow({
      "AVG HGT.": "",
      EXP: "",
      "ADJ. T": "0",
    });

    const { data, errors } = normalizeTorvikCsv([row], 2025);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);

    // Height, experience, and tempo should be absent
    expect(data[0].avgHeight).toBeUndefined();
    expect(data[0].experience).toBeUndefined();
    expect(data[0].adjTempo).toBeUndefined(); // tempo=0 treated as missing
  });

  it("reports errors for missing required efficiency fields", () => {
    const row = makeCsvRow({ "ADJ OE": "", "ADJ DE": "" });

    const { data, errors } = normalizeTorvikCsv([row], 2025);

    expect(errors).toHaveLength(2);
    expect(errors[0].field).toBe("ADJ OE");
    expect(errors[1].field).toBe("ADJ DE");
    expect(data[0].ratings).toBeUndefined();
  });

  it("normalizes multiple rows", () => {
    const rows = [
      makeCsvRow({ TEAM: "Duke" }),
      makeCsvRow({ TEAM: "North Carolina", "ADJ OE": "115.2" }),
      makeCsvRow({ TEAM: "Kentucky", "ADJ OE": "118.0" }),
    ];

    const { data, errors } = normalizeTorvikCsv(rows, 2025);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(3);
    expect(data[0].team?.name).toBe("Duke");
    expect(data[1].team?.name).toBe("North Carolina");
    expect(data[2].team?.name).toBe("Kentucky");
    expect(data[1].ratings?.torvik?.adjOE).toBe(115.2);
  });

  it("sets conference to empty string (Teams Table has no conference column)", () => {
    const { data } = normalizeTorvikCsv([makeCsvRow()], 2025);
    expect(data[0].team?.conference).toBe("");
  });

  it("trims whitespace from team names", () => {
    const row = makeCsvRow({ TEAM: "  Duke  " });
    const { data } = normalizeTorvikCsv([row], 2025);
    expect(data[0].team?.name).toBe("Duke");
  });

  it("accepts old OP REB% column name for defensive rebounding", () => {
    // Some older CSVs use "OP REB%" instead of "OP OREB%"
    const row = makeCsvRow();
    delete (row as Record<string, unknown>)["OP OREB%"];
    (row as Record<string, unknown>)["OP REB%"] = "25.6";

    const { data, errors } = normalizeTorvikCsv([row], 2025);

    expect(errors).toHaveLength(0);
    expect(data[0].fourFactorsDefense?.orbPct).toBe(25.6);
  });

  it("skips Four Factors when any field is missing", () => {
    const row = makeCsvRow({ EFG: "" }); // Missing offense EFG
    const { data } = normalizeTorvikCsv([row], 2025);
    expect(data[0].fourFactorsOffense).toBeUndefined();
    // Defense should still be present
    expect(data[0].fourFactorsDefense).toBeDefined();
  });
});
