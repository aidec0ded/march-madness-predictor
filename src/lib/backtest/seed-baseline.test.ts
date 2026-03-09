import { describe, it, expect } from "vitest";
import { getSeedBaselineProbability } from "@/lib/backtest/seed-baseline";
import type { TournamentRound } from "@/types/team";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getSeedBaselineProbability", () => {
  // -----------------------------------------------------------------------
  // Round of 64 — Historical win rate lookups
  // -----------------------------------------------------------------------

  describe("Round of 64 (R64)", () => {
    it("returns ~0.993 for a 1-seed vs 16-seed", () => {
      const prob = getSeedBaselineProbability(1, 16, "R64");
      expect(prob).toBeCloseTo(0.993, 3);
    });

    it("returns ~0.007 for a 16-seed vs 1-seed (reversed)", () => {
      const prob = getSeedBaselineProbability(16, 1, "R64");
      expect(prob).toBeCloseTo(0.007, 3);
    });

    it("returns ~0.511 for an 8-seed vs 9-seed", () => {
      const prob = getSeedBaselineProbability(8, 9, "R64");
      expect(prob).toBeCloseTo(0.511, 3);
    });

    it("returns ~0.649 for a 5-seed vs 12-seed", () => {
      const prob = getSeedBaselineProbability(5, 12, "R64");
      expect(prob).toBeCloseTo(0.649, 3);
    });
  });

  // -----------------------------------------------------------------------
  // Equal seeds — coin flip in any round
  // -----------------------------------------------------------------------

  describe("equal seeds", () => {
    it("returns 0.5 for equal seeds in R64", () => {
      expect(getSeedBaselineProbability(8, 8, "R64")).toBe(0.5);
    });

    it("returns 0.5 for equal seeds in R32", () => {
      expect(getSeedBaselineProbability(3, 3, "R32")).toBe(0.5);
    });

    it("returns 0.5 for equal seeds in NCG", () => {
      expect(getSeedBaselineProbability(1, 1, "NCG")).toBe(0.5);
    });
  });

  // -----------------------------------------------------------------------
  // Later rounds — Logistic model
  // -----------------------------------------------------------------------

  describe("later rounds (R32+)", () => {
    it("gives the higher seed > 0.5 probability (1-seed vs 4-seed in R32)", () => {
      const prob = getSeedBaselineProbability(1, 4, "R32");
      expect(prob).toBeGreaterThan(0.5);
      // With k=0.15, diff=3: 1/(1+exp(-0.45)) ≈ 0.6106
      expect(prob).toBeCloseTo(0.6106, 2);
    });

    it("gives the lower seed < 0.5 probability (4-seed vs 1-seed in R32)", () => {
      const prob = getSeedBaselineProbability(4, 1, "R32");
      expect(prob).toBeLessThan(0.5);
      expect(prob).toBeCloseTo(1 - 0.6106, 2);
    });

    it("approaches 1.0 for large seed differentials (1 vs 16 in S16)", () => {
      const prob = getSeedBaselineProbability(1, 16, "S16");
      // k=0.15, diff=15: 1/(1+exp(-2.25)) ≈ 0.9048
      expect(prob).toBeGreaterThan(0.9);
    });

    it("is close to 0.5 for small seed differentials (3 vs 4 in E8)", () => {
      const prob = getSeedBaselineProbability(3, 4, "E8");
      // k=0.15, diff=1: 1/(1+exp(-0.15)) ≈ 0.5374
      expect(prob).toBeCloseTo(0.5374, 2);
      expect(prob).toBeGreaterThan(0.5);
      expect(prob).toBeLessThan(0.6);
    });

    it("uses the logistic model for Final Four matchups", () => {
      const prob = getSeedBaselineProbability(1, 2, "F4");
      // k=0.15, diff=1: same as above ≈ 0.5374
      expect(prob).toBeCloseTo(0.5374, 2);
    });
  });

  // -----------------------------------------------------------------------
  // Symmetry: P(A beats B) + P(B beats A) = 1.0
  // -----------------------------------------------------------------------

  describe("symmetry", () => {
    it("P(A beats B) + P(B beats A) = 1.0 in R64", () => {
      const pAB = getSeedBaselineProbability(3, 14, "R64");
      const pBA = getSeedBaselineProbability(14, 3, "R64");
      expect(pAB + pBA).toBeCloseTo(1.0, 10);
    });

    it("P(A beats B) + P(B beats A) = 1.0 in later rounds", () => {
      const rounds: TournamentRound[] = ["R32", "S16", "E8", "F4", "NCG"];
      for (const round of rounds) {
        const pAB = getSeedBaselineProbability(2, 7, round);
        const pBA = getSeedBaselineProbability(7, 2, round);
        expect(pAB + pBA).toBeCloseTo(1.0, 10);
      }
    });
  });
});
