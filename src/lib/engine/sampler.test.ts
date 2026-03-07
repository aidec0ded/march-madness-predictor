/**
 * Tests for the game outcome sampler and seeded random number generator.
 *
 * Validates that:
 * - sampleGameOutcome correctly maps random values to game outcomes
 * - createSeededRandom produces deterministic, reproducible sequences
 * - Generated random values are in the expected [0, 1) range
 * - Distribution of random values is approximately uniform
 */

import { describe, it, expect } from "vitest";

import { sampleGameOutcome, createSeededRandom } from "@/lib/engine/sampler";

// ---------------------------------------------------------------------------
// sampleGameOutcome
// ---------------------------------------------------------------------------

describe("sampleGameOutcome", () => {
  it("returns 'A' when random value is less than probability", () => {
    // If probability = 0.7 and random returns 0.3, team A wins
    const result = sampleGameOutcome(0.7, () => 0.3);
    expect(result).toBe("A");
  });

  it("returns 'B' when random value is greater than or equal to probability", () => {
    // If probability = 0.7 and random returns 0.8, team B wins
    const result = sampleGameOutcome(0.7, () => 0.8);
    expect(result).toBe("B");
  });

  it("returns 'B' when random value exactly equals probability", () => {
    // Boundary: if probability = 0.5 and random returns 0.5, team B wins
    // (convention: random() < probability => A wins)
    const result = sampleGameOutcome(0.5, () => 0.5);
    expect(result).toBe("B");
  });

  it("returns 'A' when probability is very high (0.999) and random is low", () => {
    const result = sampleGameOutcome(0.999, () => 0.001);
    expect(result).toBe("A");
  });

  it("returns 'A' when probability is very high (0.999) and random is 0.998", () => {
    const result = sampleGameOutcome(0.999, () => 0.998);
    expect(result).toBe("A");
  });

  it("returns 'B' when probability is very low (0.001) and random is 0.5", () => {
    const result = sampleGameOutcome(0.001, () => 0.5);
    expect(result).toBe("B");
  });

  it("returns 'A' when probability is 1.0 for any random value less than 1", () => {
    const result = sampleGameOutcome(1.0, () => 0.999);
    expect(result).toBe("A");
  });

  it("returns 'B' when probability is 0.0 for any random value", () => {
    const result = sampleGameOutcome(0.0, () => 0.0);
    expect(result).toBe("B");
  });

  it("returns 'A' when random value is 0 and probability is greater than 0", () => {
    const result = sampleGameOutcome(0.001, () => 0.0);
    expect(result).toBe("A");
  });

  it("produces correct win rates over many samples", () => {
    const probability = 0.6;
    const numSamples = 10000;
    let aWins = 0;

    const rng = createSeededRandom(42);
    for (let i = 0; i < numSamples; i++) {
      if (sampleGameOutcome(probability, rng) === "A") {
        aWins++;
      }
    }

    const observedRate = aWins / numSamples;
    // With 10000 samples, the observed rate should be within ~3% of the true rate
    expect(observedRate).toBeGreaterThan(0.55);
    expect(observedRate).toBeLessThan(0.65);
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe("createSeededRandom", () => {
  it("produces deterministic sequences with the same seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);

    const seq1 = Array.from({ length: 100 }, () => rng1());
    const seq2 = Array.from({ length: 100 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it("produces different sequences with different seeds", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(123);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    // Extremely unlikely (essentially impossible) for 20 random floats to match
    expect(seq1).not.toEqual(seq2);
  });

  it("generates values in the [0, 1) range", () => {
    const rng = createSeededRandom(99);
    const values = Array.from({ length: 10000 }, () => rng());

    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("never generates exactly 1.0", () => {
    const rng = createSeededRandom(777);
    const values = Array.from({ length: 50000 }, () => rng());

    for (const value of values) {
      expect(value).not.toBe(1.0);
    }
  });

  it("produces a roughly uniform distribution across 10 buckets", () => {
    const rng = createSeededRandom(12345);
    const numSamples = 10000;
    const numBuckets = 10;
    const buckets = new Array(numBuckets).fill(0);

    for (let i = 0; i < numSamples; i++) {
      const value = rng();
      const bucket = Math.min(Math.floor(value * numBuckets), numBuckets - 1);
      buckets[bucket]++;
    }

    // Each bucket should have between 8% and 12% of samples (800-1200 out of 10000)
    const minExpected = numSamples * 0.08;
    const maxExpected = numSamples * 0.12;

    for (let i = 0; i < numBuckets; i++) {
      expect(buckets[i]).toBeGreaterThan(minExpected);
      expect(buckets[i]).toBeLessThan(maxExpected);
    }
  });

  it("produces different values for consecutive calls (not constant)", () => {
    const rng = createSeededRandom(42);
    const first = rng();
    const second = rng();
    const third = rng();

    // While technically possible for two to match, it's astronomically unlikely
    expect(first).not.toBe(second);
    expect(second).not.toBe(third);
  });

  it("handles seed value of 0", () => {
    const rng = createSeededRandom(0);
    const values = Array.from({ length: 10 }, () => rng());

    // Should still produce valid numbers
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("handles negative seed values", () => {
    const rng = createSeededRandom(-42);
    const values = Array.from({ length: 10 }, () => rng());

    // Should still produce valid numbers
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("handles very large seed values", () => {
    const rng = createSeededRandom(2147483647);
    const values = Array.from({ length: 10 }, () => rng());

    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("state advances properly after many calls", () => {
    const rng = createSeededRandom(42);

    // Generate 1000 values
    for (let i = 0; i < 1000; i++) {
      rng();
    }

    // The 1001st value should be deterministic
    const rng2 = createSeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      rng2();
    }

    expect(rng()).toBe(rng2());
  });
});
