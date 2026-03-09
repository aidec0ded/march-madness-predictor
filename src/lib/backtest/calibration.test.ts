import { describe, it, expect } from "vitest";
import { buildCalibrationBins } from "@/lib/backtest/calibration";
import type { BrierGameScore } from "@/types/backtest";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal BrierGameScore for calibration testing.
 * Only predictedProbA and actualOutcome matter for binning.
 */
function makeGameScore(
  predictedProbA: number,
  actualOutcome: number
): BrierGameScore {
  return {
    season: 2024,
    round: "R64",
    teamAName: "Team A",
    teamASeed: 1,
    teamBName: "Team B",
    teamBSeed: 16,
    predictedProbA,
    actualOutcome,
    brierScore: (predictedProbA - actualOutcome) ** 2,
    usedBaseline: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildCalibrationBins", () => {
  describe("basic structure", () => {
    it("returns 10 bins by default", () => {
      const bins = buildCalibrationBins([]);
      expect(bins).toHaveLength(10);
    });

    it("returns the correct bin boundaries for 10 bins", () => {
      const bins = buildCalibrationBins([]);
      expect(bins[0].binStart).toBeCloseTo(0.0);
      expect(bins[0].binEnd).toBeCloseTo(0.1);
      expect(bins[9].binStart).toBeCloseTo(0.9);
      expect(bins[9].binEnd).toBeCloseTo(1.0);
    });

    it("computes correct midpoints for all bins", () => {
      const bins = buildCalibrationBins([]);
      expect(bins[0].midpoint).toBeCloseTo(0.05);
      expect(bins[4].midpoint).toBeCloseTo(0.45);
      expect(bins[9].midpoint).toBeCloseTo(0.95);
    });
  });

  describe("empty input", () => {
    it("returns 10 bins all with count 0 and default values", () => {
      const bins = buildCalibrationBins([]);
      expect(bins).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(bins[i].count).toBe(0);
        expect(bins[i].actualWinRate).toBe(0);
        expect(bins[i].avgPredicted).toBeCloseTo(bins[i].midpoint);
      }
    });
  });

  describe("all predictions in one bin", () => {
    it("places all predictions in the correct bin with others empty", () => {
      const scores = [
        makeGameScore(0.75, 1),
        makeGameScore(0.72, 0),
        makeGameScore(0.78, 1),
      ];

      const bins = buildCalibrationBins(scores);

      // All should be in bin 7 (0.7–0.8)
      expect(bins[7].count).toBe(3);

      // All other bins should be empty
      for (let i = 0; i < 10; i++) {
        if (i !== 7) {
          expect(bins[i].count).toBe(0);
        }
      }
    });
  });

  describe("predictions spread across bins", () => {
    it("distributes predictions into correct bins", () => {
      const scores = [
        makeGameScore(0.05, 0), // bin 0
        makeGameScore(0.15, 0), // bin 1
        makeGameScore(0.25, 0), // bin 2
        makeGameScore(0.55, 1), // bin 5
        makeGameScore(0.65, 1), // bin 6
        makeGameScore(0.85, 1), // bin 8
      ];

      const bins = buildCalibrationBins(scores);

      expect(bins[0].count).toBe(1);
      expect(bins[1].count).toBe(1);
      expect(bins[2].count).toBe(1);
      expect(bins[3].count).toBe(0);
      expect(bins[4].count).toBe(0);
      expect(bins[5].count).toBe(1);
      expect(bins[6].count).toBe(1);
      expect(bins[7].count).toBe(0);
      expect(bins[8].count).toBe(1);
      expect(bins[9].count).toBe(0);
    });
  });

  describe("perfect calibration scenario", () => {
    it("shows avgPredicted ≈ actualWinRate when predictions = 0.5 and outcomes are 50/50", () => {
      const scores = [
        makeGameScore(0.50, 1),
        makeGameScore(0.50, 0),
        makeGameScore(0.50, 1),
        makeGameScore(0.50, 0),
      ];

      const bins = buildCalibrationBins(scores);

      // All in bin 5 (0.5–0.6) since 0.50 >= 0.5 and < 0.6
      expect(bins[5].count).toBe(4);
      expect(bins[5].avgPredicted).toBeCloseTo(0.5);
      expect(bins[5].actualWinRate).toBeCloseTo(0.5);
    });
  });

  describe("custom bin count", () => {
    it("creates the specified number of bins", () => {
      const bins = buildCalibrationBins([], 5);
      expect(bins).toHaveLength(5);
      expect(bins[0].binStart).toBeCloseTo(0.0);
      expect(bins[0].binEnd).toBeCloseTo(0.2);
      expect(bins[4].binStart).toBeCloseTo(0.8);
      expect(bins[4].binEnd).toBeCloseTo(1.0);
    });

    it("correctly bins predictions with 5 bins", () => {
      const scores = [
        makeGameScore(0.15, 0), // bin 0 (0.0–0.2)
        makeGameScore(0.55, 1), // bin 2 (0.4–0.6)
        makeGameScore(0.95, 1), // bin 4 (0.8–1.0)
      ];

      const bins = buildCalibrationBins(scores, 5);

      expect(bins[0].count).toBe(1);
      expect(bins[1].count).toBe(0);
      expect(bins[2].count).toBe(1);
      expect(bins[3].count).toBe(0);
      expect(bins[4].count).toBe(1);
    });
  });

  describe("edge case: prediction = 1.0", () => {
    it("places a prediction of exactly 1.0 in the last bin", () => {
      const scores = [makeGameScore(1.0, 1)];

      const bins = buildCalibrationBins(scores);

      expect(bins[9].count).toBe(1);
      expect(bins[9].avgPredicted).toBeCloseTo(1.0);
      expect(bins[9].actualWinRate).toBeCloseTo(1.0);
    });
  });

  describe("edge case: prediction = 0.0", () => {
    it("places a prediction of exactly 0.0 in the first bin", () => {
      const scores = [makeGameScore(0.0, 0)];

      const bins = buildCalibrationBins(scores);

      expect(bins[0].count).toBe(1);
      expect(bins[0].avgPredicted).toBeCloseTo(0.0);
      expect(bins[0].actualWinRate).toBeCloseTo(0.0);
    });
  });

  describe("actualWinRate calculation", () => {
    it("computes the correct win rate (3 wins out of 5 = 0.6)", () => {
      const scores = [
        makeGameScore(0.65, 1),
        makeGameScore(0.62, 1),
        makeGameScore(0.68, 0),
        makeGameScore(0.61, 1),
        makeGameScore(0.69, 0),
      ];

      const bins = buildCalibrationBins(scores);

      // All in bin 6 (0.6–0.7)
      expect(bins[6].count).toBe(5);
      expect(bins[6].actualWinRate).toBeCloseTo(0.6);
    });
  });

  describe("avgPredicted calculation", () => {
    it("computes the correct average predicted probability in a bin", () => {
      const scores = [
        makeGameScore(0.30, 1),
        makeGameScore(0.35, 0),
        makeGameScore(0.38, 1),
      ];

      const bins = buildCalibrationBins(scores);

      // All in bin 3 (0.3–0.4)
      expect(bins[3].count).toBe(3);
      // Average: (0.30 + 0.35 + 0.38) / 3 = 0.3433...
      expect(bins[3].avgPredicted).toBeCloseTo(0.3433, 3);
    });
  });

  describe("boundary predictions", () => {
    it("places a prediction on a bin boundary in the higher bin", () => {
      // 0.3 is exactly on the boundary between bin 2 (0.2–0.3) and bin 3 (0.3–0.4)
      // Since bin 2 uses < 0.3 as upper bound, 0.3 should go in bin 3
      const scores = [makeGameScore(0.3, 1)];

      const bins = buildCalibrationBins(scores);

      expect(bins[2].count).toBe(0);
      expect(bins[3].count).toBe(1);
    });
  });

  describe("error handling", () => {
    it("throws an error if numBins is less than 1", () => {
      expect(() => buildCalibrationBins([], 0)).toThrow(
        "numBins must be at least 1"
      );
    });
  });
});
