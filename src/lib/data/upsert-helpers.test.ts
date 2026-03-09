/**
 * Tests for the pure helper functions in the upsert-helpers module.
 *
 * Async Supabase functions (upsertTeams, upsertTeamSeasons, etc.) are not
 * tested here because they require a live database connection. Those should
 * be covered by integration tests.
 */

import { describe, it, expect } from "vitest";
import { nanToNull, generateShortName, SHORT_NAME_OVERRIDES, BATCH_SIZE } from "./upsert-helpers";

// ---------------------------------------------------------------------------
// Tests: nanToNull
// ---------------------------------------------------------------------------

describe("nanToNull", () => {
  it("should return the number when given a valid number", () => {
    expect(nanToNull(42)).toBe(42);
  });

  it("should return the number when given a negative number", () => {
    expect(nanToNull(-10.5)).toBe(-10.5);
  });

  it("should return 0 when given 0", () => {
    expect(nanToNull(0)).toBe(0);
  });

  it("should return null when given NaN", () => {
    expect(nanToNull(NaN)).toBeNull();
  });

  it("should return null when given undefined", () => {
    expect(nanToNull(undefined)).toBeNull();
  });

  it("should return null when given null", () => {
    expect(nanToNull(null)).toBeNull();
  });

  it("should return the number for very large values", () => {
    expect(nanToNull(1e15)).toBe(1e15);
  });

  it("should return the number for very small positive values", () => {
    expect(nanToNull(0.0001)).toBe(0.0001);
  });

  it("should return the number for Infinity", () => {
    // Infinity is a valid number (not NaN), so it passes through
    expect(nanToNull(Infinity)).toBe(Infinity);
  });

  it("should return the number for negative Infinity", () => {
    expect(nanToNull(-Infinity)).toBe(-Infinity);
  });
});

// ---------------------------------------------------------------------------
// Tests: generateShortName
// ---------------------------------------------------------------------------

describe("generateShortName", () => {
  // -------------------------------------------------------------------------
  // Names in the override map
  // -------------------------------------------------------------------------

  it("should return the override for 'Connecticut'", () => {
    expect(generateShortName("Connecticut")).toBe("UConn");
  });

  it("should return the override for 'North Carolina'", () => {
    expect(generateShortName("North Carolina")).toBe("UNC");
  });

  it("should return the override for 'Southern California'", () => {
    expect(generateShortName("Southern California")).toBe("USC");
  });

  it("should return the override for 'Virginia Commonwealth'", () => {
    expect(generateShortName("Virginia Commonwealth")).toBe("VCU");
  });

  it("should return the override for 'Florida Gulf Coast'", () => {
    expect(generateShortName("Florida Gulf Coast")).toBe("FGCU");
  });

  it("should return the override for 'Saint Mary's'", () => {
    expect(generateShortName("Saint Mary's")).toBe("St. Mary's");
  });

  it("should return the override for 'Massachusetts'", () => {
    expect(generateShortName("Massachusetts")).toBe("UMass");
  });

  it("should return the override for 'Southeastern Louisiana'", () => {
    expect(generateShortName("Southeastern Louisiana")).toBe("SE Louisiana");
  });

  // -------------------------------------------------------------------------
  // Short names (no override, <= 20 chars)
  // -------------------------------------------------------------------------

  it("should return the name as-is when it is short and not in overrides", () => {
    expect(generateShortName("Duke")).toBe("Duke");
  });

  it("should return the name as-is when it is exactly 20 characters", () => {
    const twentyChar = "A".repeat(20);
    expect(generateShortName(twentyChar)).toBe(twentyChar);
  });

  it("should return the name as-is for a typical team name", () => {
    expect(generateShortName("Kansas")).toBe("Kansas");
  });

  it("should return the name as-is for an empty string", () => {
    expect(generateShortName("")).toBe("");
  });

  // -------------------------------------------------------------------------
  // Long names (no override, > 20 chars)
  // -------------------------------------------------------------------------

  it("should truncate to 20 characters when name is long and not in overrides", () => {
    const longName = "University of Some Very Long Name";
    expect(generateShortName(longName)).toBe("University of Some V");
    expect(generateShortName(longName).length).toBe(20);
  });

  it("should truncate a 21-character name", () => {
    const twentyOne = "A".repeat(21);
    expect(generateShortName(twentyOne)).toBe("A".repeat(20));
  });
});

// ---------------------------------------------------------------------------
// Tests: SHORT_NAME_OVERRIDES
// ---------------------------------------------------------------------------

describe("SHORT_NAME_OVERRIDES", () => {
  it("should be a non-empty record", () => {
    expect(Object.keys(SHORT_NAME_OVERRIDES).length).toBeGreaterThan(0);
  });

  it("should contain key expected entries", () => {
    expect(SHORT_NAME_OVERRIDES["Connecticut"]).toBe("UConn");
    expect(SHORT_NAME_OVERRIDES["Brigham Young"]).toBe("BYU");
    expect(SHORT_NAME_OVERRIDES["Texas Christian"]).toBe("TCU");
  });
});

// ---------------------------------------------------------------------------
// Tests: BATCH_SIZE
// ---------------------------------------------------------------------------

describe("BATCH_SIZE", () => {
  it("should be 50", () => {
    expect(BATCH_SIZE).toBe(50);
  });
});
