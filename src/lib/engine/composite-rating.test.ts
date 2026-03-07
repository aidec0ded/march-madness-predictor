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

function makeRating(
  source: EfficiencyRatings["source"],
  adjOE: number,
  adjDE: number
): EfficiencyRatings {
  return { source, adjOE, adjDE, adjEM: adjOE - adjDE };
}

const kenpomRating = makeRating("kenpom", 120, 95); // adjEM = 25
const torvikRating = makeRating("torvik", 118, 93); // adjEM = 25
const evanmiyaRating = makeRating("evanmiya", 115, 90); // adjEM = 25

// Ratings with different margins to test weighted averaging
const kenpomDiverse = makeRating("kenpom", 120, 100); // adjEM = 20
const torvikDiverse = makeRating("torvik", 115, 95); // adjEM = 20
const evanmiyaDiverse = makeRating("evanmiya", 110, 100); // adjEM = 10

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateCompositeRating", () => {
  describe("all three sources present", () => {
    it("computes a simple average when weights are equal", () => {
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

      // Simple average of adjOE: (120 + 118 + 115) / 3 = 117.6667
      expect(result.adjOE).toBeCloseTo(117.6667, 3);
      // Simple average of adjDE: (95 + 93 + 90) / 3 = 92.6667
      expect(result.adjDE).toBeCloseTo(92.6667, 3);
      // adjEM = adjOE - adjDE = 25.0
      expect(result.adjEM).toBeCloseTo(25.0, 3);
      expect(result.sources).toHaveLength(3);
    });

    it("computes a weighted average with default weights (0.4/0.35/0.25)", () => {
      const result = calculateCompositeRating(
        {
          kenpom: kenpomRating,
          torvik: torvikRating,
          evanmiya: evanmiyaRating,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // Weighted adjOE: 120*0.4 + 118*0.35 + 115*0.25 = 48 + 41.3 + 28.75 = 118.05
      expect(result.adjOE).toBeCloseTo(118.05, 3);
      // Weighted adjDE: 95*0.4 + 93*0.35 + 90*0.25 = 38 + 32.55 + 22.5 = 93.05
      expect(result.adjDE).toBeCloseTo(93.05, 3);
      // adjEM = 118.05 - 93.05 = 25.0
      expect(result.adjEM).toBeCloseTo(25.0, 3);
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

    it("derives adjEM from adjOE - adjDE, not from averaged adjEMs", () => {
      // Use ratings where sources have the same adjEM but different adjOE/adjDE
      // This verifies adjEM is computed from composite components
      const result = calculateCompositeRating(
        {
          kenpom: kenpomDiverse,
          torvik: torvikDiverse,
          evanmiya: evanmiyaDiverse,
        },
        DEFAULT_COMPOSITE_WEIGHTS
      );

      // Weighted adjOE: 120*0.4 + 115*0.35 + 110*0.25 = 48 + 40.25 + 27.5 = 115.75
      expect(result.adjOE).toBeCloseTo(115.75, 3);
      // Weighted adjDE: 100*0.4 + 95*0.35 + 100*0.25 = 40 + 33.25 + 25 = 98.25
      expect(result.adjDE).toBeCloseTo(98.25, 3);
      // adjEM = adjOE - adjDE = 115.75 - 98.25 = 17.5
      expect(result.adjEM).toBeCloseTo(17.5, 3);

      // Verify this is NOT the same as the weighted average of adjEMs
      // Weighted adjEMs: 20*0.4 + 20*0.35 + 10*0.25 = 8 + 7 + 2.5 = 17.5
      // In this case they happen to be equal because adjEM = adjOE - adjDE is linear.
      // This is expected for consistent data. The key property is the function
      // always computes adjEM = adjOE - adjDE rather than averaging adjEMs directly.
      expect(result.adjEM).toBe(result.adjOE - result.adjDE);
    });

    it("records correct sources in the breakdown", () => {
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

      // Weighted adjOE: 120 * 0.5333 + 118 * 0.4667 = 64 + 55.067 = 119.067
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

      const resultEvanmiya = calculateCompositeRating({
        evanmiya: evanmiyaRating,
      });

      expect(resultEvanmiya.sources).toHaveLength(1);
      expect(resultEvanmiya.sources[0].weight).toBe(1);
      expect(resultEvanmiya.adjOE).toBe(115);
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

      // Result should be very close to evanmiya values
      expect(result.adjOE).toBeCloseTo(115.1, 0);
      expect(result.adjDE).toBeCloseTo(90.1, 0);
    });
  });

  describe("adjEM consistency", () => {
    it("adjEM always equals adjOE - adjDE regardless of source data", () => {
      // Test with asymmetric ratings where adjEM != weighted average of source adjEMs
      const asymKenpom = makeRating("kenpom", 125, 100); // adjEM = 25
      const asymTorvik = makeRating("torvik", 110, 95); // adjEM = 15
      const asymEvanmiya = makeRating("evanmiya", 105, 100); // adjEM = 5

      const result = calculateCompositeRating({
        kenpom: asymKenpom,
        torvik: asymTorvik,
        evanmiya: asymEvanmiya,
      });

      expect(result.adjEM).toBe(result.adjOE - result.adjDE);
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
