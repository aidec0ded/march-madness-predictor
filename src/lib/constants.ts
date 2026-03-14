/**
 * Application-wide constants.
 *
 * CURRENT_SEASON is the single source of truth for the active tournament year.
 * Update this value once per year when rolling to the next season — every file
 * in the app and scripts imports from here, so a single change propagates
 * everywhere.
 */

/** The active NCAA tournament season year (e.g., 2026 for the 2025-26 season). */
export const CURRENT_SEASON = 2026;

/** The public-facing site name, used in the navbar, page titles, and metadata. */
export const SITE_NAME = "The Bracket Lab";

/** Tournament title shown in the bracket header. */
export const TOURNAMENT_TITLE = `${CURRENT_SEASON} Men's D1 Basketball Tournament`;
