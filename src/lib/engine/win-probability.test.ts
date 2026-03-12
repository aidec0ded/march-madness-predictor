import { describe, it, expect } from "vitest";
import {
  calculateWinProbability,
  ratingDiffToSpread,
  clampProbability,
} from "@/lib/engine/win-probability";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";

// ---------------------------------------------------------------------------
// Constants for readability
// ---------------------------------------------------------------------------

const DEFAULT_K = DEFAULT_ENGINE_CONFIG.logisticK; // 0.11

describe("calculateWinProbability", () => {
  describe("basic properties", () => {
    it("returns 0.5 for an even matchup (ratingDiff = 0)", () => {
      expect(calculateWinProbability(0)).toBe(0.5);
    });

    it("returns > 0.5 when team A has a positive rating differential", () => {
      expect(calculateWinProbability(5)).toBeGreaterThan(0.5);
      expect(calculateWinProbability(10)).toBeGreaterThan(0.5);
      expect(calculateWinProbability(0.1)).toBeGreaterThan(0.5);
    });

    it("returns < 0.5 when team A has a negative rating differential", () => {
      expect(calculateWinProbability(-5)).toBeLessThan(0.5);
      expect(calculateWinProbability(-10)).toBeLessThan(0.5);
      expect(calculateWinProbability(-0.1)).toBeLessThan(0.5);
    });

    it("increases monotonically with rating differential", () => {
      const p5 = calculateWinProbability(5);
      const p10 = calculateWinProbability(10);
      const p20 = calculateWinProbability(20);
      const p30 = calculateWinProbability(30);

      expect(p10).toBeGreaterThan(p5);
      expect(p20).toBeGreaterThan(p10);
      expect(p30).toBeGreaterThan(p20);
    });
  });

  describe("symmetry", () => {
    it("P(A|diff=d) + P(A|diff=-d) = 1 (perfect symmetry)", () => {
      const diffs = [1, 5, 10, 15, 20, 25, 30];

      for (const d of diffs) {
        const pPositive = calculateWinProbability(d);
        const pNegative = calculateWinProbability(-d);

        // Allow tiny floating point tolerance, but clamping may affect extreme values
        // For moderate diffs, symmetry should be near-exact
        if (d <= 25) {
          expect(pPositive + pNegative).toBeCloseTo(1.0, 10);
        }
      }
    });

    it("is symmetric for typical tournament matchup differentials", () => {
      const diff = 8; // ~8-seed vs ~1-seed
      const pA = calculateWinProbability(diff);
      const pB = calculateWinProbability(-diff);

      expect(pA + pB).toBeCloseTo(1.0, 10);
    });
  });

  describe("typical tournament matchups (with default k=0.11)", () => {
    // The default k=0.11 is derived from the standard basketball variance model:
    //   k = (possessions/100) / (σ_game × π/√3) ≈ 0.68 / 6.27 ≈ 0.11
    //
    // Computed values:
    //   P(35) = 1/(1 + exp(-3.85)) ≈ 0.979 (1 vs 16, ~35 pt EM diff)
    //   P(10) = 1/(1 + exp(-1.10)) ≈ 0.750 (5 vs 12, ~10 pt EM diff)
    //   P(2)  = 1/(1 + exp(-0.22)) ≈ 0.555 (8 vs 9, ~2 pt EM diff)

    it("1-seed vs 16-seed (~35 point EM diff) yields strong favorite", () => {
      const p = calculateWinProbability(35);
      // With k=0.11: P ≈ 0.979
      expect(p).toBeGreaterThanOrEqual(0.97);
      expect(p).toBeLessThanOrEqual(0.99);
    });

    it("5-seed vs 12-seed (~10 point EM diff) yields clear edge", () => {
      const p = calculateWinProbability(10);
      // With k=0.11: P ≈ 0.750
      expect(p).toBeGreaterThanOrEqual(0.73);
      expect(p).toBeLessThanOrEqual(0.77);
    });

    it("8-seed vs 9-seed (~2 point EM diff) yields slight favorite", () => {
      const p = calculateWinProbability(2);
      // With k=0.11: P ≈ 0.555
      expect(p).toBeGreaterThanOrEqual(0.54);
      expect(p).toBeLessThanOrEqual(0.57);
    });

    it("strong 2-seed vs weak 15-seed (~25 point EM diff) yields strong favorite", () => {
      const p = calculateWinProbability(25);
      // With k=0.11: P ≈ 0.940
      expect(p).toBeGreaterThan(0.93);
    });

    it("produces more decisive outcomes with a steeper k", () => {
      // With a steeper k (~0.175):
      // P(20) ≈ 0.97, which matches the ~97% historical 1-vs-16 win rate
      const k_steep = 0.175;
      const p = calculateWinProbability(20, k_steep);
      expect(p).toBeGreaterThanOrEqual(0.96);
      expect(p).toBeLessThanOrEqual(0.999);
    });
  });

  describe("clamping behavior", () => {
    it("never returns a probability greater than 0.999", () => {
      // With k=0.11, even moderate differentials can hit the clamp:
      // exp(-0.11 * 100) = exp(-11) ≈ 1.7e-5, so P ≈ 0.99998 → clamped to 0.999
      const p = calculateWinProbability(500);
      expect(p).toBeLessThanOrEqual(0.999);
      expect(p).toBe(0.999);
    });

    it("never returns a probability less than 0.001", () => {
      // Symmetric to the above: extremely large negative differential
      const p = calculateWinProbability(-500);
      expect(p).toBeGreaterThanOrEqual(0.001);
      expect(p).toBe(0.001);
    });

    it("does not clamp moderate probabilities", () => {
      const p = calculateWinProbability(10);
      expect(p).toBeGreaterThan(0.001);
      expect(p).toBeLessThan(0.999);
    });

    it("clamps when using a steep k with large differential", () => {
      // With k=0.175, P(100) = 1/(1+exp(-17.5)) ≈ 1 - 2.5e-8 → clamped to 0.999
      const p = calculateWinProbability(100, 0.175);
      expect(p).toBe(0.999);

      const pNeg = calculateWinProbability(-100, 0.175);
      expect(pNeg).toBe(0.001);
    });
  });

  describe("scaling factor (k) behavior", () => {
    it("uses default k from EngineConfig when not specified", () => {
      // Calculate manually with default k
      const diff = 10;
      const expectedRaw = 1 / (1 + Math.exp(-DEFAULT_K * diff));
      expect(calculateWinProbability(diff)).toBeCloseTo(expectedRaw, 10);
    });

    it("higher k produces more extreme probabilities", () => {
      const diff = 10;
      const pDefault = calculateWinProbability(diff, 0.11);
      const pHighK = calculateWinProbability(diff, 0.22); // Double k

      expect(pHighK).toBeGreaterThan(pDefault);
    });

    it("lower k produces more moderate probabilities (closer to 0.5)", () => {
      const diff = 10;
      const pDefault = calculateWinProbability(diff, 0.11);
      const pLowK = calculateWinProbability(diff, 0.055); // Half k

      expect(pLowK).toBeLessThan(pDefault);
      expect(pLowK).toBeGreaterThan(0.5);
    });

    it("k = 0 yields P = 0.5 for any differential", () => {
      expect(calculateWinProbability(10, 0)).toBe(0.5);
      expect(calculateWinProbability(-20, 0)).toBe(0.5);
      expect(calculateWinProbability(100, 0)).toBe(0.5);
    });
  });

  describe("mathematical correctness", () => {
    it("matches the logistic formula exactly for known inputs", () => {
      const k = 0.11;
      const diff = 15;
      const expected = 1 / (1 + Math.exp(-k * diff));
      expect(calculateWinProbability(diff, k)).toBeCloseTo(expected, 10);
    });

    it("is a pure function (same inputs yield same outputs)", () => {
      const p1 = calculateWinProbability(12.5);
      const p2 = calculateWinProbability(12.5);
      expect(p1).toBe(p2);
    });
  });
});

describe("ratingDiffToSpread", () => {
  it("returns 0 for an even matchup", () => {
    // -(0 * 68 / 100) produces -0 in IEEE 754. We verify the magnitude is 0.
    const spread = ratingDiffToSpread(0);
    expect(spread).toBeCloseTo(0, 15);
    expect(Math.abs(spread)).toBe(0);
  });

  it("returns a negative spread when team A is favored (positive ratingDiff)", () => {
    const spread = ratingDiffToSpread(10);
    expect(spread).toBeLessThan(0);
    // 10 * 68 / 100 = 6.8 → spread = -6.8
    expect(spread).toBeCloseTo(-6.8, 4);
  });

  it("returns a positive spread when team B is favored (negative ratingDiff)", () => {
    const spread = ratingDiffToSpread(-10);
    expect(spread).toBeGreaterThan(0);
    expect(spread).toBeCloseTo(6.8, 4);
  });

  it("scales linearly with rating differential", () => {
    const spread5 = ratingDiffToSpread(5);
    const spread10 = ratingDiffToSpread(10);
    const spread20 = ratingDiffToSpread(20);

    expect(spread10).toBeCloseTo(spread5 * 2, 10);
    expect(spread20).toBeCloseTo(spread5 * 4, 10);
  });

  it("uses default avgPossessions = 68", () => {
    // Verify the default: spread = -(diff * 68 / 100)
    const spread = ratingDiffToSpread(14.7);
    expect(spread).toBeCloseTo(-(14.7 * 68) / 100, 10);
  });

  it("accepts a custom avgPossessions parameter", () => {
    // Using a slower-paced game with ~60 possessions
    const spreadSlow = ratingDiffToSpread(10, 60);
    expect(spreadSlow).toBeCloseTo(-6.0, 4);

    // Using a faster-paced game with ~75 possessions
    const spreadFast = ratingDiffToSpread(10, 75);
    expect(spreadFast).toBeCloseTo(-7.5, 4);
  });

  it("produces realistic spreads for typical tournament matchups", () => {
    // 1 vs 16: ~20 EM diff → ~13.6 point spread
    const spread1v16 = ratingDiffToSpread(20);
    expect(spread1v16).toBeCloseTo(-13.6, 1);

    // 5 vs 12: ~5 EM diff → ~3.4 point spread
    const spread5v12 = ratingDiffToSpread(5);
    expect(spread5v12).toBeCloseTo(-3.4, 1);

    // 8 vs 9: ~1 EM diff → ~0.7 point spread
    const spread8v9 = ratingDiffToSpread(1);
    expect(spread8v9).toBeCloseTo(-0.68, 1);
  });
});

describe("clampProbability", () => {
  it("clamps 0 to 0.001", () => {
    expect(clampProbability(0)).toBe(0.001);
  });

  it("clamps 1 to 0.999", () => {
    expect(clampProbability(1)).toBe(0.999);
  });

  it("clamps negative values to 0.001", () => {
    expect(clampProbability(-0.5)).toBe(0.001);
    expect(clampProbability(-100)).toBe(0.001);
  });

  it("clamps values above 1 to 0.999", () => {
    expect(clampProbability(1.5)).toBe(0.999);
    expect(clampProbability(100)).toBe(0.999);
  });

  it("does not modify values within the valid range", () => {
    expect(clampProbability(0.5)).toBe(0.5);
    expect(clampProbability(0.001)).toBe(0.001);
    expect(clampProbability(0.999)).toBe(0.999);
    expect(clampProbability(0.75)).toBe(0.75);
  });

  it("handles exact boundary values correctly", () => {
    expect(clampProbability(0.001)).toBe(0.001);
    expect(clampProbability(0.999)).toBe(0.999);
    expect(clampProbability(0.0005)).toBe(0.001);
    expect(clampProbability(0.9995)).toBe(0.999);
  });

  it("is a pure function", () => {
    expect(clampProbability(0.65)).toBe(clampProbability(0.65));
  });
});
