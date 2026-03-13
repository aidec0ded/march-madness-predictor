import { describe, it, expect } from "vitest";
import { deserializeGlobalLevers } from "./lever-serialization";
import {
  DEFAULT_GLOBAL_LEVERS,
  DEFAULT_COMPOSITE_WEIGHTS,
  DEFAULT_FOUR_FACTORS_WEIGHTS,
} from "@/types/engine";

describe("deserializeGlobalLevers", () => {
  it("returns full defaults for empty object", () => {
    const result = deserializeGlobalLevers({});
    expect(result).toEqual(DEFAULT_GLOBAL_LEVERS);
  });

  it("returns full defaults for non-object input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = deserializeGlobalLevers(null as any);
    expect(result).toEqual(DEFAULT_GLOBAL_LEVERS);
  });

  it("merges partial scalar levers with defaults", () => {
    const result = deserializeGlobalLevers({
      experienceWeight: 2.5,
      tempoVarianceWeight: 0.5,
    });

    expect(result.experienceWeight).toBe(2.5);
    expect(result.tempoVarianceWeight).toBe(0.5);
    // Other scalars should be defaults
    expect(result.continuityWeight).toBe(DEFAULT_GLOBAL_LEVERS.continuityWeight);
    expect(result.coachExperienceWeight).toBe(DEFAULT_GLOBAL_LEVERS.coachExperienceWeight);
    // Nested objects should be defaults
    expect(result.compositeWeights).toEqual(DEFAULT_COMPOSITE_WEIGHTS);
    expect(result.fourFactors).toEqual(DEFAULT_FOUR_FACTORS_WEIGHTS);
  });

  it("merges partial composite weights with defaults", () => {
    const result = deserializeGlobalLevers({
      compositeWeights: { kenpom: 0.6 },
    });

    expect(result.compositeWeights.kenpom).toBe(0.6);
    // Other composite weights should be defaults
    expect(result.compositeWeights.torvik).toBe(DEFAULT_COMPOSITE_WEIGHTS.torvik);
    expect(result.compositeWeights.evanmiya).toBe(DEFAULT_COMPOSITE_WEIGHTS.evanmiya);
  });

  it("merges partial four factors with defaults", () => {
    const result = deserializeGlobalLevers({
      fourFactors: { efgPctOffense: 3.0, toPctDefense: 0.5 },
    });

    expect(result.fourFactors.efgPctOffense).toBe(3.0);
    expect(result.fourFactors.toPctDefense).toBe(0.5);
    // Others should be defaults
    expect(result.fourFactors.efgPctDefense).toBe(DEFAULT_FOUR_FACTORS_WEIGHTS.efgPctDefense);
    expect(result.fourFactors.orbPctOffense).toBe(DEFAULT_FOUR_FACTORS_WEIGHTS.orbPctOffense);
  });

  it("handles invalid numeric values by falling back to defaults", () => {
    const result = deserializeGlobalLevers({
      experienceWeight: "not-a-number",
      continuityWeight: NaN,
      coachExperienceWeight: Infinity,
      compositeWeights: { kenpom: "bad" },
      fourFactors: { efgPctOffense: null },
    });

    expect(result.experienceWeight).toBe(DEFAULT_GLOBAL_LEVERS.experienceWeight);
    expect(result.continuityWeight).toBe(DEFAULT_GLOBAL_LEVERS.continuityWeight);
    expect(result.coachExperienceWeight).toBe(DEFAULT_GLOBAL_LEVERS.coachExperienceWeight);
    expect(result.compositeWeights.kenpom).toBe(DEFAULT_COMPOSITE_WEIGHTS.kenpom);
    expect(result.fourFactors.efgPctOffense).toBe(DEFAULT_FOUR_FACTORS_WEIGHTS.efgPctOffense);
  });

  it("round-trips a full GlobalLevers object", () => {
    // Simulate save → JSON → load
    const original = {
      ...DEFAULT_GLOBAL_LEVERS,
      experienceWeight: 3.0,
      compositeWeights: { kenpom: 0.5, torvik: 0.3, evanmiya: 0.2 },
    };
    const serialized = JSON.parse(JSON.stringify(original));
    const result = deserializeGlobalLevers(serialized);

    expect(result.experienceWeight).toBe(3.0);
    expect(result.compositeWeights).toEqual({ kenpom: 0.5, torvik: 0.3, evanmiya: 0.2 });
    // Unmodified fields should match defaults
    expect(result.continuityWeight).toBe(DEFAULT_GLOBAL_LEVERS.continuityWeight);
  });
});
