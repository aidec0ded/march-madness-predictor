import { describe, it, expect } from "vitest";
import {
  calculateCompositeRating,
  normalizeWeights,
} from "@/lib/engine/composite-rating";
import type { EfficiencyRatings } from "@/types/team";
import type { CompositeWeights } from "@/types/engine";
import { DEFAULT_COMPOSITE_WEIGHTS } from "@/types/engine";

// ---------------------------------------------------------------------------
// Test helpers — reusable mock rating factories
// ---------------------------------------------------------------------------

/** Build a KenPom or Torvik rating where adjEM = adjOE - adjDE (differential) */
function makeDiffRating(
  source: "kenpom" | "torvik",
  adjOE: number,
  adjDE: number
): EfficiencyRatings {
  return { source, adjOE, adjDE, adjEM: adjOE - adjDE };
}

/**
 * Build an Evan Miya rating where adjEM = adjOE + adjDE (additive BPR).
 * The OE/DE are on a ~0-20 scale, NOT per-100-possessions.
 */
function makeMiyaRating(
  offBPR: number,
  defBPR: number
): EfficiencyRatings {
  return { source: "evanmiya", adjOE: offBPR, adjDE: defBPR, adjEM: offBPR + defBPR };
}

// --- Per-100-possessions sources (KenPom / Torvik) ---
const kenpomRating = makeDiffRating("kenpom", 120, 95); // adjEM = 25
const torvikRating = makeDiffRating("torvik", 118, 93); // adjEM = 25

// --- Evan Miya (additive BPR, ~0-20 scale OE/DE) ---
// BPR = 12.5 + 12.5 = 25.0 (same adjEM for simple tests)
const evanmiyaRating = makeMiyaRating(12.5, 12.5); // adjEM = 25

// Ratings with different margins to test weighted averaging
const kenpomDiverse = makeDiffRating("kenpom", 120, 100); // adjEM = 20
const torvikDiverse = makeDiffRating("torvik", 115, 95); // adjEM = 20
// Miya: offBPR=6, defBPR=4 → BPR=10 (different from KP/Torvik's 20)
const evanmiyaDiverse = makeMiyaRating(6, 4); // adjEM = 10

// Realistic Evan Miya ratings (like Tennessee/Texas from real data)
// Tennessee: OE=10.66, DE=12.15, BPR=22.81 (OE+DE)
const miyaTennessee = makeMiyaRating(10.66, 12.15); // adjEM = 22.81
// Texas: OE=14.40, DE=3.27, BPR=17.67 (OE+DE)
const miyaTexas = makeMiyaRating(14.40, 3.27); // adjEM = 17.67

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateCompositeRating", () => {
  describe("all three sources present", () => {
    it("computes adjEM as weighted average of stored adjEMs from all sources", () => {
      const equalWeights: CompositeWeights = {
        kenpom: 1,
        torvik: 1,
        evanmiya: 1,
      };

      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        equalWeights
      );

      // adjEM is a simple average of stored adjEMs: (25 + 25 + 25) / 3 = 25
      expect(result.adjEM).toBeCloseTo(25.0, 3);
      expect(result.sources).toHaveLength(3);
    });

    it("computes adjOE/adjDE only from per-100 sources (KenPom + Torvik)", () => {
      const equalWeights: CompositeWeights = {
        kenpom: 1,
        torvik: 1,
        evanmiya: 1,
      };

      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        equalWeights
      );

      // adjOE/adjDE should ONLY blend KenPom + Torvik (per-100 sources)
      // KenPom weight = 1/3, Torvik weight = 1/3 → renormalized among per-100 sources: 0.5 each
      expect(result.adjOE).toBeCloseTo((120 + 118) / 2, 3); // 119.0
      expect(result.adjDE).toBeCloseTo((95 + 93) / 2, 3); // 94.0
    });

    it("computes weighted average with default weights (0.4/0.35/0.25)", () => {
      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // Weighted adjEM: 25*0.4 + 25*0.35 + 25*0.25 = 25.0
      expect(result.adjEM).toBeCloseTo(25.0, 3);

      // adjOE/adjDE from KenPom+Torvik only, renormalized:
      // KenPom weight 0.4, Torvik weight 0.35 → renormalized: 0.4/0.75, 0.35/0.75
      const kpW = 0.4 / 0.75;
      const tvW = 0.35 / 0.75;
      expect(result.adjOE).toBeCloseTo(120 * kpW + 118 * tvW, 3);
      expect(result.adjDE).toBeCloseTo(95 * kpW + 93 * tvW, 3);
    });

    it("uses default weights when no weights are provided", () => {
      const result = calculateCompositeRating({
        kenpom: kenpomRating,
        torvik: torvikRating,
        evanmiya: evanmiyaRating,
      });

      // Should produce same result as explicitly passing DEFAULT_COMPOSITE_WEIGHTS
      const explicit = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      expect(result.adjOE).toBeCloseTo(explicit.adjOE, 10);
      expect(result.adjDE).toBeCloseTo(explicit.adjDE, 10);
      expect(result.adjEM).toBeCloseTo(explicit.adjEM, 10);
    });

    it("adjEM is a direct weighted average of source adjEMs, not derived from adjOE-adjDE", () => {
      // Use ratings where Evan Miya adjEM differs from what adjOE-adjDE would give
      const result = calculateCompositeRating(
        {
          kenpom: kenpomDiverse,
          torvik: torvikDiverse,
          evanmiya: evanmiyaDiverse,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // Weighted adjEM: 20*0.4 + 20*0.35 + 10*0.25 = 8 + 7 + 2.5 = 17.5
      expect(result.adjEM).toBeCloseTo(17.5, 3);

      // adjOE/adjDE from KP+Torvik only (renormalized weights)
      const kpW = 0.4 / 0.75;
      const tvW = 0.35 / 0.75;
      const expectedOE = 120 * kpW + 115 * tvW;
      const expectedDE = 100 * kpW + 95 * tvW;
      expect(result.adjOE).toBeCloseTo(expectedOE, 3);
      expect(result.adjDE).toBeCloseTo(expectedDE, 3);

      // Note: adjEM ≠ adjOE - adjDE because adjEM blends ALL sources
      // while adjOE/adjDE only blend per-100 sources
    });

    it("records correct sources with stored adjEM in the breakdown", () => {
      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      expect(result.sources).toEqual([
        { source: "kenpom", weight: 0.4, adjEM: 25 },
        { source: "torvik", weight: 0.35, adjEM: 25 },
        { source: "evanmiya", weight: 0.25, adjEM: 25 },
      ]);
    });
  });

  describe("Evan Miya scale handling", () => {
    it("uses Evan Miya BPR (additive: OE+DE) as adjEM, not OE-DE", () => {
      // Tennessee Evan Miya: OE=10.66, DE=12.15, BPR=22.81
      // The OLD code would compute 10.66 - 12.15 = -1.49 (WRONG)
      // The NEW code uses the stored adjEM = 22.81 (CORRECT)
      const result = calculateCompositeRating({
        evanmiya: miyaTennessee,
      });

      expect(result.adjEM).toBeCloseTo(22.81, 2);
      expect(result.sources[0].adjEM).toBeCloseTo(22.81, 2);
    });

    it("correctly blends Evan Miya BPR with KenPom/Torvik adjEM", () => {
      // KenPom: adjEM = 25.5 (OE - DE)
      // Torvik: adjEM = 26.5
      // Evan Miya: BPR = 22.81 (OE + DE)
      const kp = makeDiffRating("kenpom", 126.1, 100.6); // adjEM = 25.5
      const tv = makeDiffRating("torvik", 126.7, 100.2); // adjEM = 26.5

      const result = calculateCompositeRating(
        { kenpom: kp, torvik: tv, evanmiya: miyaTennessee },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // adjEM = 25.5*0.4 + 26.5*0.35 + 22.81*0.25 = 10.2 + 9.275 + 5.7025 = 25.1775
      expect(result.adjEM).toBeCloseTo(25.1775, 2);

      // adjOE/adjDE only from KP+Torvik (renormalized)
      const kpW = 0.4 / 0.75;
      const tvW = 0.35 / 0.75;
      expect(result.adjOE).toBeCloseTo(126.1 * kpW + 126.7 * tvW, 2);
      expect(result.adjDE).toBeCloseTo(100.6 * kpW + 100.2 * tvW, 2);
    });

    it("does NOT contaminate adjOE/adjDE with Evan Miya's ~0-20 scale values", () => {
      // This was the original bug: blending Miya OE=14.40 with KenPom OE=126.1
      // would produce a composite OE of ~96 (way too low)
      const kp = makeDiffRating("kenpom", 126.1, 100.6);
      const result = calculateCompositeRating(
        { kenpom: kp, evanmiya: miyaTexas },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // adjOE should be KenPom-only since it's the only per-100 source
      expect(result.adjOE).toBeCloseTo(126.1, 2);
      expect(result.adjDE).toBeCloseTo(100.6, 2);

      // adjEM should blend both: 25.5 * (0.4/0.65) + 17.67 * (0.25/0.65)
      const kpW = 0.4 / 0.65;
      const myW = 0.25 / 0.65;
      expect(result.adjEM).toBeCloseTo(25.5 * kpW + 17.67 * myW, 2);
    });

    it("derives adjOE/adjDE from baseline when only Evan Miya is available", () => {
      // When only Miya is available, adjOE and adjDE are estimated from
      // D1 baseline (105) ± adjEM/2
      const result = calculateCompositeRating({
        evanmiya: miyaTennessee,
      });

      // adjEM = 22.81
      expect(result.adjEM).toBeCloseTo(22.81, 2);
      // adjOE = 105 + 22.81/2 = 116.405
      expect(result.adjOE).toBeCloseTo(105 + 22.81 / 2, 2);
      // adjDE = 105 - 22.81/2 = 93.595
      expect(result.adjDE).toBeCloseTo(105 - 22.81 / 2, 2);
    });
  });

  describe("missing sources — renormalization", () => {
    it("renormalizes weights when one source is missing (no evanmiya)", () => {
      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          // evanmiya is missing
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // Renormalized weights: kenpom = 0.4/(0.4+0.35) = 0.5333, torvik = 0.35/0.75 = 0.4667
      const expectedKenpomWeight = 0.4 / 0.75;
      const expectedTorvikWeight = 0.35 / 0.75;

      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].weight).toBeCloseTo(expectedKenpomWeight, 4);
      expect(result.sources[1].weight).toBeCloseTo(expectedTorvikWeight, 4);

      // Both sources are per-100, so adjOE/adjDE use the same renormalized weights
      const expectedAdjOE =
        120 * expectedKenpomWeight + 118 * expectedTorvikWeight;
      expect(result.adjOE).toBeCloseTo(expectedAdjOE, 3);
    });

    it("renormalizes weights when one source is missing (no kenpom)", () => {
      const result = calculateCompositeRating(
        {
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // Renormalized: torvik = 0.35/(0.35+0.25) = 0.5833, evanmiya = 0.25/0.6 = 0.4167
      const expectedTorvikWeight = 0.35 / 0.6;
      const expectedEvanmiyaWeight = 0.25 / 0.6;

      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].weight).toBeCloseTo(expectedTorvikWeight, 4);
      expect(result.sources[1].weight).toBeCloseTo(expectedEvanmiyaWeight, 4);

      // adjOE/adjDE only from Torvik (the only per-100 source)
      expect(result.adjOE).toBeCloseTo(118, 3);
      expect(result.adjDE).toBeCloseTo(93, 3);

      // adjEM blends both sources
      expect(result.adjEM).toBeCloseTo(
        25 * expectedTorvikWeight + 25 * expectedEvanmiyaWeight,
        3
      );
    });

    it("renormalizes weights when one source is missing (no torvik)", () => {
      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          evanmiya: evanmiyaRating,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      const expectedKenpomWeight = 0.4 / 0.65;
      const expectedEvanmiyaWeight = 0.25 / 0.65;

      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].weight).toBeCloseTo(expectedKenpomWeight, 4);
      expect(result.sources[1].weight).toBeCloseTo(expectedEvanmiyaWeight, 4);

      // adjOE/adjDE only from KenPom
      expect(result.adjOE).toBeCloseTo(120, 3);
      expect(result.adjDE).toBeCloseTo(95, 3);
    });

    it("uses single source at 100% when two sources are missing", () => {
      const resultKenpom = calculateCompositeRating({
        kenpom: kenpomRating,
      });

      expect(resultKenpom.sources).toHaveLength(1);
      expect(resultKenpom.sources[0].weight).toBe(1);
      expect(resultKenpom.adjOE).toBe(120);
      expect(resultKenpom.adjDE).toBe(95);
      expect(resultKenpom.adjEM).toBe(25);

      const resultTorvik = calculateCompositeRating({
        torvik: torvikRating,
      });

      expect(resultTorvik.sources).toHaveLength(1);
      expect(resultTorvik.sources[0].weight).toBe(1);
      expect(resultTorvik.adjOE).toBe(118);

      // Evan Miya only — adjOE/adjDE estimated from baseline
      const resultEvanmiya = calculateCompositeRating({
        evanmiya: evanmiyaRating,
      });

      expect(resultEvanmiya.sources).toHaveLength(1);
      expect(resultEvanmiya.sources[0].weight).toBe(1);
      expect(resultEvanmiya.adjEM).toBe(25);
      // OE/DE estimated from D1 baseline (105) ± adjEM/2
      expect(resultEvanmiya.adjOE).toBeCloseTo(105 + 25 / 2, 3);
      expect(resultEvanmiya.adjDE).toBeCloseTo(105 - 25 / 2, 3);
    });
  });

  describe("error handling", () => {
    it("throws when no sources are available", () => {
      expect(() => calculateCompositeRating({})).toThrow(
        "Cannot calculate composite rating: no data sources available"
      );
    });

    it("throws when all sources are explicitly undefined", () => {
      expect(() =>
        calculateCompositeRating({
          kenpom: undefined,
          torvik: undefined,
          evanmiya: undefined,
        })
      ).toThrow("Cannot calculate composite rating: no data sources available");
    });
  });

  describe("weight normalization", () => {
    it("normalizes weights that do not sum to 1", () => {
      const weights: CompositeWeights = {
        kenpom: 2,
        torvik: 2,
        evanmiya: 1,
      };

      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        weights
      );

      // Renormalized: kenpom = 2/5 = 0.4, torvik = 2/5 = 0.4, evanmiya = 1/5 = 0.2
      expect(result.sources[0].weight).toBeCloseTo(0.4, 4);
      expect(result.sources[1].weight).toBeCloseTo(0.4, 4);
      expect(result.sources[2].weight).toBeCloseTo(0.2, 4);

      // Verify weights sum to 1
      const totalWeight = result.sources.reduce((sum, s) => sum + s.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 10);
    });

    it("handles very small weights correctly", () => {
      const weights: CompositeWeights = {
        kenpom: 0.01,
        torvik: 0.01,
        evanmiya: 0.98,
      };

      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        weights
      );

      // adjEM should be very close to evanmiya adjEM (25)
      expect(result.adjEM).toBeCloseTo(25, 0);
      // adjOE/adjDE should blend KP+Torvik only (tiny weights, but renormalized to 50/50)
      expect(result.adjOE).toBeCloseTo((120 + 118) / 2, 0);
    });
  });
});

describe("normalizeWeights", () => {
  it("normalizes weights that sum to more than 1", () => {
    const result = normalizeWeights({ kenpom: 2, torvik: 2, evanmiya: 1 });
    expect(result.kenpom).toBeCloseTo(0.4, 4);
    expect(result.torvik).toBeCloseTo(0.4, 4);
    expect(result.evanmiya).toBeCloseTo(0.2, 4);
  });

  it("preserves weights that already sum to 1", () => {
    const result = normalizeWeights({
      kenpom: 0.5,
      torvik: 0.3,
      evanmiya: 0.2,
    });
    expect(result.kenpom).toBeCloseTo(0.5, 10);
    expect(result.torvik).toBeCloseTo(0.3, 10);
    expect(result.evanmiya).toBeCloseTo(0.2, 10);
  });

  it("normalizes weights that sum to less than 1", () => {
    const result = normalizeWeights({
      kenpom: 0.1,
      torvik: 0.1,
      evanmiya: 0.1,
    });
    expect(result.kenpom).toBeCloseTo(1 / 3, 4);
    expect(result.torvik).toBeCloseTo(1 / 3, 4);
    expect(result.evanmiya).toBeCloseTo(1 / 3, 4);
  });

  it("throws when total weight is zero", () => {
    expect(() =>
      normalizeWeights({ kenpom: 0, torvik: 0, evanmiya: 0 })
    ).toThrow("Cannot normalize weights");
  });
});
