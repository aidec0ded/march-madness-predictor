/**
 * Recency Divergence Rule
 *
 * Flags two conditions:
 * 1. Large recent form overrides (|recentFormA| or |recentFormB| > 2.0)
 *    applied to a matchup — these indicate significant manual adjustments
 *    that users should be aware are active.
 * 2. When a team's rating sources disagree by more than 5 efficiency points
 *    (e.g., KenPom says +18 but Torvik says +12). Large source disagreement
 *    signals uncertainty in the team's true strength.
 */

import type { GuidanceMessage, GuidanceContext } from "@/types/guidance";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Absolute recent form override threshold */
const FORM_OVERRIDE_THRESHOLD = 2.0;

/** Rating source disagreement threshold (efficiency points) */
const SOURCE_DISAGREEMENT_THRESHOLD = 5.0;

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export function recencyDivergenceRule(
  context: GuidanceContext
): GuidanceMessage[] {
  const { picks, teams, matchupOverrides } = context;
  const messages: GuidanceMessage[] = [];

  // --- Check for large recent form overrides ---
  for (const [gameId, overrides] of Object.entries(matchupOverrides)) {
    const formA = overrides.recentFormA ?? 0;
    const formB = overrides.recentFormB ?? 0;

    if (Math.abs(formA) > FORM_OVERRIDE_THRESHOLD) {
      const winnerId = picks[gameId];
      const team = winnerId ? teams.get(winnerId) : undefined;

      messages.push({
        id: `recency-form-a-${gameId}`,
        title: `Large form override in ${gameId}`,
        description:
          `Team A has a recent form adjustment of ${formA > 0 ? "+" : ""}${formA.toFixed(1)} ` +
          `efficiency points in this matchup${team ? ` (picked: ${team.team.shortName})` : ""}. ` +
          `Adjustments above +/-${FORM_OVERRIDE_THRESHOLD} represent a significant ` +
          `departure from season-long ratings. Make sure this reflects a real ` +
          `trajectory change (injury return, lineup shift) rather than recency bias.`,
        severity: "info",
        category: "recency_divergence",
        gameId,
      });
    }

    if (Math.abs(formB) > FORM_OVERRIDE_THRESHOLD) {
      const winnerId = picks[gameId];
      const team = winnerId ? teams.get(winnerId) : undefined;

      messages.push({
        id: `recency-form-b-${gameId}`,
        title: `Large form override in ${gameId}`,
        description:
          `Team B has a recent form adjustment of ${formB > 0 ? "+" : ""}${formB.toFixed(1)} ` +
          `efficiency points in this matchup${team ? ` (picked: ${team.team.shortName})` : ""}. ` +
          `Adjustments above +/-${FORM_OVERRIDE_THRESHOLD} represent a significant ` +
          `departure from season-long ratings. Make sure this reflects a real ` +
          `trajectory change (injury return, lineup shift) rather than recency bias.`,
        severity: "info",
        category: "recency_divergence",
        gameId,
      });
    }
  }

  // --- Check for rating source disagreement ---
  const flaggedSourceTeams = new Set<string>();

  for (const winnerId of Object.values(picks)) {
    if (flaggedSourceTeams.has(winnerId)) continue;

    const team = teams.get(winnerId);
    if (!team) continue;

    const ratings: number[] = [];
    if (team.ratings.kenpom) ratings.push(team.ratings.kenpom.adjEM);
    if (team.ratings.torvik) ratings.push(team.ratings.torvik.adjEM);
    if (team.ratings.evanmiya) ratings.push(team.ratings.evanmiya.adjEM);

    if (ratings.length < 2) continue;

    const maxRating = Math.max(...ratings);
    const minRating = Math.min(...ratings);
    const spread = maxRating - minRating;

    if (spread > SOURCE_DISAGREEMENT_THRESHOLD) {
      flaggedSourceTeams.add(winnerId);

      messages.push({
        id: `recency-source-disagreement-${winnerId}`,
        title: `${team.team.shortName}: rating sources disagree`,
        description:
          `The rating sources for ${team.team.shortName} disagree by ` +
          `${spread.toFixed(1)} efficiency points ` +
          `(range: ${minRating.toFixed(1)} to ${maxRating.toFixed(1)}). ` +
          `This level of disagreement (>${SOURCE_DISAGREEMENT_THRESHOLD} pts) ` +
          `suggests genuine uncertainty about this team's true strength. ` +
          `Consider which source best captures this team's profile and ` +
          `whether the composite weight settings reflect your confidence.`,
        severity: "warning",
        category: "recency_divergence",
        teamIds: [winnerId],
      });
    }
  }

  return messages;
}
