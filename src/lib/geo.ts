/**
 * Geographic distance utilities for site proximity calculations.
 *
 * Provides haversine distance (great-circle distance between two lat/lng points)
 * and automatic site proximity bucketing based on configured distance thresholds.
 *
 * @module
 */

import type { SiteProximityBucket } from "@/types/team";
import { SITE_PROXIMITY_THRESHOLDS } from "@/types/engine";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Earth's mean radius in miles */
const EARTH_RADIUS_MILES = 3958.8;

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

/**
 * Calculates the great-circle distance between two points on Earth
 * using the haversine formula.
 *
 * @param lat1 - Latitude of point 1 (degrees)
 * @param lng1 - Longitude of point 1 (degrees)
 * @param lat2 - Latitude of point 2 (degrees)
 * @param lng2 - Longitude of point 2 (degrees)
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

// ---------------------------------------------------------------------------
// Site proximity bucketing
// ---------------------------------------------------------------------------

/**
 * Determines the site proximity bucket for a team based on the distance
 * from their campus to the tournament site.
 *
 * Uses the distance thresholds defined in SITE_PROXIMITY_THRESHOLDS:
 * - < 50 miles → "true_home"
 * - 50–200 miles → "regional_advantage"
 * - 200–500 miles → "neutral"
 * - 500–1000 miles → "moderate_travel"
 * - 1000+ miles → "significant_travel"
 *
 * @param campusLat - Team campus latitude
 * @param campusLng - Team campus longitude
 * @param siteLat - Tournament site latitude
 * @param siteLng - Tournament site longitude
 * @returns The appropriate SiteProximityBucket
 */
export function getSiteProximityBucket(
  campusLat: number,
  campusLng: number,
  siteLat: number,
  siteLng: number
): SiteProximityBucket {
  const distance = haversineDistance(campusLat, campusLng, siteLat, siteLng);

  if (distance < SITE_PROXIMITY_THRESHOLDS.true_home) {
    return "true_home";
  }
  if (distance < SITE_PROXIMITY_THRESHOLDS.regional_advantage) {
    return "regional_advantage";
  }
  if (distance < SITE_PROXIMITY_THRESHOLDS.neutral) {
    return "neutral";
  }
  if (distance < SITE_PROXIMITY_THRESHOLDS.moderate_travel) {
    return "moderate_travel";
  }
  return "significant_travel";
}
