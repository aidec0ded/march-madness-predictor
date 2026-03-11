/**
 * Tests for geographic distance and site proximity bucketing utilities.
 */

import { describe, it, expect } from "vitest";
import { haversineDistance, getSiteProximityBucket } from "./geo";

// ---------------------------------------------------------------------------
// Well-known reference coordinates
// ---------------------------------------------------------------------------

const COORDS = {
  // Campuses
  durhamNC: { lat: 35.9971, lng: -78.9382 }, // Duke
  storrsOhCT: { lat: 41.8084, lng: -72.2495 }, // UConn
  gonzagaWA: { lat: 47.6673, lng: -117.4024 }, // Gonzaga
  tucsonAZ: { lat: 32.2319, lng: -110.9501 }, // Arizona
  westLafayetteIN: { lat: 40.4237, lng: -86.9212 }, // Purdue
  losAngelesCA: { lat: 34.0689, lng: -118.4452 }, // UCLA

  // Tournament sites
  greenvilleSC: { lat: 34.8526, lng: -82.394 },
  indianapolisIN: { lat: 39.7684, lng: -86.1581 },
  sanDiegoCA: { lat: 32.7157, lng: -117.1611 },
  portlandOR: { lat: 45.5152, lng: -122.6784 },
  houstonTX: { lat: 29.7604, lng: -95.3698 },
  daytonOH: { lat: 39.7589, lng: -84.1916 },
} as const;

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------

describe("haversineDistance", () => {
  it("returns 0 for the same point", () => {
    const d = haversineDistance(40.0, -80.0, 40.0, -80.0);
    expect(d).toBe(0);
  });

  it("calculates Durham NC → Greenville SC (~250 miles)", () => {
    const d = haversineDistance(
      COORDS.durhamNC.lat,
      COORDS.durhamNC.lng,
      COORDS.greenvilleSC.lat,
      COORDS.greenvilleSC.lng
    );
    // Should be approximately 230-270 miles
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(300);
  });

  it("calculates Gonzaga WA → Portland OR (~280 miles)", () => {
    const d = haversineDistance(
      COORDS.gonzagaWA.lat,
      COORDS.gonzagaWA.lng,
      COORDS.portlandOR.lat,
      COORDS.portlandOR.lng
    );
    expect(d).toBeGreaterThan(250);
    expect(d).toBeLessThan(350);
  });

  it("calculates Purdue IN → Indianapolis IN (~65 miles)", () => {
    const d = haversineDistance(
      COORDS.westLafayetteIN.lat,
      COORDS.westLafayetteIN.lng,
      COORDS.indianapolisIN.lat,
      COORDS.indianapolisIN.lng
    );
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(80);
  });

  it("calculates UCLA → San Diego (~115 miles)", () => {
    const d = haversineDistance(
      COORDS.losAngelesCA.lat,
      COORDS.losAngelesCA.lng,
      COORDS.sanDiegoCA.lat,
      COORDS.sanDiegoCA.lng
    );
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(130);
  });

  it("calculates cross-country distances (Gonzaga → Greenville ~2000 miles)", () => {
    const d = haversineDistance(
      COORDS.gonzagaWA.lat,
      COORDS.gonzagaWA.lng,
      COORDS.greenvilleSC.lat,
      COORDS.greenvilleSC.lng
    );
    expect(d).toBeGreaterThan(1900);
    expect(d).toBeLessThan(2100);
  });

  it("is symmetric (A→B equals B→A)", () => {
    const ab = haversineDistance(
      COORDS.durhamNC.lat,
      COORDS.durhamNC.lng,
      COORDS.houstonTX.lat,
      COORDS.houstonTX.lng
    );
    const ba = haversineDistance(
      COORDS.houstonTX.lat,
      COORDS.houstonTX.lng,
      COORDS.durhamNC.lat,
      COORDS.durhamNC.lng
    );
    expect(ab).toBeCloseTo(ba, 10);
  });
});

// ---------------------------------------------------------------------------
// getSiteProximityBucket
// ---------------------------------------------------------------------------

describe("getSiteProximityBucket", () => {
  it("returns 'true_home' for same location (0 miles)", () => {
    const bucket = getSiteProximityBucket(40.0, -80.0, 40.0, -80.0);
    expect(bucket).toBe("true_home");
  });

  it("returns 'true_home' for Dayton team near Dayton site (<50 mi)", () => {
    // Dayton to Dayton = ~0 miles
    const bucket = getSiteProximityBucket(
      COORDS.daytonOH.lat,
      COORDS.daytonOH.lng,
      COORDS.daytonOH.lat,
      COORDS.daytonOH.lng
    );
    expect(bucket).toBe("true_home");
  });

  it("returns 'regional_advantage' for Purdue → Indianapolis (~65 mi)", () => {
    const bucket = getSiteProximityBucket(
      COORDS.westLafayetteIN.lat,
      COORDS.westLafayetteIN.lng,
      COORDS.indianapolisIN.lat,
      COORDS.indianapolisIN.lng
    );
    expect(bucket).toBe("regional_advantage");
  });

  it("returns 'regional_advantage' for UCLA → San Diego (~115 mi)", () => {
    const bucket = getSiteProximityBucket(
      COORDS.losAngelesCA.lat,
      COORDS.losAngelesCA.lng,
      COORDS.sanDiegoCA.lat,
      COORDS.sanDiegoCA.lng
    );
    expect(bucket).toBe("regional_advantage");
  });

  it("returns 'neutral' for Duke → Greenville SC (~250 mi)", () => {
    const bucket = getSiteProximityBucket(
      COORDS.durhamNC.lat,
      COORDS.durhamNC.lng,
      COORDS.greenvilleSC.lat,
      COORDS.greenvilleSC.lng
    );
    expect(bucket).toBe("neutral");
  });

  it("returns 'neutral' for Gonzaga → Portland (~280 mi)", () => {
    const bucket = getSiteProximityBucket(
      COORDS.gonzagaWA.lat,
      COORDS.gonzagaWA.lng,
      COORDS.portlandOR.lat,
      COORDS.portlandOR.lng
    );
    expect(bucket).toBe("neutral");
  });

  it("returns 'significant_travel' for Duke → Houston (~1050 mi)", () => {
    const bucket = getSiteProximityBucket(
      COORDS.durhamNC.lat,
      COORDS.durhamNC.lng,
      COORDS.houstonTX.lat,
      COORDS.houstonTX.lng
    );
    expect(bucket).toBe("significant_travel");
  });

  it("returns 'significant_travel' for Gonzaga → Greenville (~2400 mi)", () => {
    const bucket = getSiteProximityBucket(
      COORDS.gonzagaWA.lat,
      COORDS.gonzagaWA.lng,
      COORDS.greenvilleSC.lat,
      COORDS.greenvilleSC.lng
    );
    expect(bucket).toBe("significant_travel");
  });

  it("returns 'significant_travel' for UConn → San Diego (~2500 mi)", () => {
    const bucket = getSiteProximityBucket(
      COORDS.storrsOhCT.lat,
      COORDS.storrsOhCT.lng,
      COORDS.sanDiegoCA.lat,
      COORDS.sanDiegoCA.lng
    );
    expect(bucket).toBe("significant_travel");
  });
});
