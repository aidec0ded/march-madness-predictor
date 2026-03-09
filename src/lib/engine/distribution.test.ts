/**
 * Tests for the matchup distribution generator.
 */

import { describe, it, expect } from "vitest";
import {
  generateMatchupDistribution,
  getDistributionSampleCount,
} from "./distribution";

describe("generateMatchupDistribution", () => {
  it("bin counts sum to the sample count", () => {
    const bins = generateMatchupDistribution(0, 7.5, 42);
    const totalCount = bins.reduce((sum, bin) => sum + bin.count, 0);
    expect(totalCount).toBe(getDistributionSampleCount());
  });

  it("favored team (A) has more winning bins when spread is positive", () => {
    // Team A favored by 10 points
    const bins = generateMatchupDistribution(10, 7.5, 123);

    const teamAWins = bins
      .filter((b) => b.winner === "A")
      .reduce((sum, b) => sum + b.count, 0);
    const teamBWins = bins
      .filter((b) => b.winner === "B")
      .reduce((sum, b) => sum + b.count, 0);

    expect(teamAWins).toBeGreaterThan(teamBWins);
  });

  it("favored team (B) has more winning bins when spread is negative", () => {
    // Team B favored by 8 points
    const bins = generateMatchupDistribution(-8, 7.5, 456);

    const teamAWins = bins
      .filter((b) => b.winner === "A")
      .reduce((sum, b) => sum + b.count, 0);
    const teamBWins = bins
      .filter((b) => b.winner === "B")
      .reduce((sum, b) => sum + b.count, 0);

    expect(teamBWins).toBeGreaterThan(teamAWins);
  });

  it("distribution is roughly symmetric for equal teams (spread = 0)", () => {
    const bins = generateMatchupDistribution(0, 7.5, 789);

    const teamAWins = bins
      .filter((b) => b.winner === "A")
      .reduce((sum, b) => sum + b.count, 0);
    const teamBWins = bins
      .filter((b) => b.winner === "B")
      .reduce((sum, b) => sum + b.count, 0);

    const total = teamAWins + teamBWins;
    const ratio = teamAWins / total;

    // With 1000 samples, expect roughly 50/50, allow generous tolerance
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it("produces deterministic results with the same seed", () => {
    const bins1 = generateMatchupDistribution(5, 7.5, 42);
    const bins2 = generateMatchupDistribution(5, 7.5, 42);

    expect(bins1).toEqual(bins2);
  });

  it("produces different results with different seeds", () => {
    const bins1 = generateMatchupDistribution(5, 7.5, 42);
    const bins2 = generateMatchupDistribution(5, 7.5, 99);

    // At least some bins should differ
    const hasDifference = bins1.some(
      (b, i) => b.count !== bins2[i].count
    );
    expect(hasDifference).toBe(true);
  });

  it("all bins have correct winner labels", () => {
    const bins = generateMatchupDistribution(0, 7.5, 42);

    for (const bin of bins) {
      if (bin.margin >= 0) {
        expect(bin.winner).toBe("A");
      } else {
        expect(bin.winner).toBe("B");
      }
    }
  });

  it("produces 30 bins from -30 to +30 with bin width 2", () => {
    const bins = generateMatchupDistribution(0, 7.5, 42);
    expect(bins.length).toBe(30);

    // First bin center should be -29
    expect(bins[0].margin).toBe(-29);
    // Last bin center should be +29
    expect(bins[bins.length - 1].margin).toBe(29);
  });
});
