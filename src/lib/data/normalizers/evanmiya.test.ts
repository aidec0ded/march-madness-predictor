/**
 * Tests for the Evan Miya CSV normalizer.
 */

import { describe, it, expect } from "vitest";
import { normalizeEvanMiya } from "./evanmiya";
import type { EvanMiyaCsvRow } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<EvanMiyaCsvRow> = {}): EvanMiyaCsvRow {
  return {
    team: "Michigan",
    obpr: "21.36",
    dbpr: "18.95",
    bpr: "40.31",
    opponent_adjust: "57.00",
    pace_adjust: "30.37",
    runs_per_game: "1.19",
    runs_conceded_per_game: "0.10",
    runs_margin: "1.10",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalizeEvanMiya", () => {
  it("should normalize a valid CSV row into a partial TeamSeason", () => {
    const { data, errors } = normalizeEvanMiya([makeRow()], 2026);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);

    const ts = data[0];
    expect(ts.season).toBe(2026);
    expect(ts.dataSources).toEqual(["evanmiya"]);
    expect(ts.team?.name).toBe("Michigan");

    // Efficiency ratings
    expect(ts.ratings?.evanmiya?.source).toBe("evanmiya");
    expect(ts.ratings?.evanmiya?.adjOE).toBeCloseTo(21.36);
    expect(ts.ratings?.evanmiya?.adjDE).toBeCloseTo(18.95);
    expect(ts.ratings?.evanmiya?.adjEM).toBeCloseTo(40.31);

    // Miya-specific metrics
    expect(ts.evanmiyaOpponentAdjust).toBeCloseTo(57.0);
    expect(ts.evanmiyaPaceAdjust).toBeCloseTo(30.37);
    expect(ts.evanmiyaKillShotsPerGame).toBeCloseTo(1.19);
    expect(ts.evanmiyaKillShotsAllowedPerGame).toBeCloseTo(0.1);
    expect(ts.evanmiyaKillShotsMargin).toBeCloseTo(1.1);
  });

  it("should handle multiple rows", () => {
    const rows = [
      makeRow({ team: "Michigan", bpr: "40.31" }),
      makeRow({ team: "Duke", bpr: "36.96", obpr: "17.01", dbpr: "19.95" }),
    ];

    const { data, errors } = normalizeEvanMiya(rows, 2026);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(2);
    expect(data[0].team?.name).toBe("Michigan");
    expect(data[1].team?.name).toBe("Duke");
    expect(data[1].ratings?.evanmiya?.adjEM).toBeCloseTo(36.96);
  });

  it("should produce errors for missing BPR fields", () => {
    const row = makeRow({ bpr: "", obpr: "" });
    const { data, errors } = normalizeEvanMiya([row], 2026);

    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.field === "bpr")).toBe(true);
    expect(errors.some((e) => e.field === "obpr")).toBe(true);

    // Ratings should be undefined since BPR fields failed
    expect(data[0].ratings).toBeUndefined();
  });

  it("should handle missing optional metrics gracefully", () => {
    const row = makeRow({
      opponent_adjust: "",
      pace_adjust: "",
      runs_per_game: "",
      runs_conceded_per_game: "",
      runs_margin: "",
    });

    const { data, errors } = normalizeEvanMiya([row], 2026);

    expect(errors).toHaveLength(0);
    expect(data[0].evanmiyaOpponentAdjust).toBeUndefined();
    expect(data[0].evanmiyaPaceAdjust).toBeUndefined();
    expect(data[0].evanmiyaKillShotsPerGame).toBeUndefined();
    expect(data[0].evanmiyaKillShotsAllowedPerGame).toBeUndefined();
    expect(data[0].evanmiyaKillShotsMargin).toBeUndefined();

    // BPR ratings should still be present
    expect(data[0].ratings?.evanmiya?.adjEM).toBeCloseTo(40.31);
  });

  it("should handle negative values for opponent/pace adjust", () => {
    const row = makeRow({
      opponent_adjust: "-29.22",
      pace_adjust: "-15.50",
      runs_margin: "-0.50",
    });

    const { data, errors } = normalizeEvanMiya([row], 2026);

    expect(errors).toHaveLength(0);
    expect(data[0].evanmiyaOpponentAdjust).toBeCloseTo(-29.22);
    expect(data[0].evanmiyaPaceAdjust).toBeCloseTo(-15.5);
    expect(data[0].evanmiyaKillShotsMargin).toBeCloseTo(-0.5);
  });

  it("should trim team names", () => {
    const row = makeRow({ team: "  Michigan  " });
    const { data } = normalizeEvanMiya([row], 2026);
    expect(data[0].team?.name).toBe("Michigan");
  });

  it("should ignore extra CSV columns", () => {
    const row = {
      ...makeRow(),
      rank: "1",
      tooltip_team: "Michigan 🔥",
      color_O: "#FF9D23",
      wins: "29",
      losses: "2",
    };

    const { data, errors } = normalizeEvanMiya([row], 2026);

    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(1);
    expect(data[0].ratings?.evanmiya?.adjEM).toBeCloseTo(40.31);
  });
});
