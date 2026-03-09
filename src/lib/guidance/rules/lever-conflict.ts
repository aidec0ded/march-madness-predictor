/**
 * Lever Conflict Rule
 *
 * Detects tensions between the user's lever weight configuration and their
 * bracket picks. For example, if the experience lever is weighted heavily
 * but the user picks a team with low D-1 experience to advance deep, this
 * rule surfaces the contradiction.
 *
 * Conflicts checked:
 * - High experience weight + low-experience team advancing past R32
 * - High continuity weight + low-continuity team advancing past R32
 * - High coach weight + inexperienced coach team advancing past R32
 */

import type { GuidanceMessage, GuidanceContext } from "@/types/guidance";
import { parseGameId } from "@/lib/bracket-layout";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Lever weight threshold above which we consider the lever "heavily weighted" */
const HIGH_LEVER_WEIGHT = 1.5;

/** Experience threshold below which a team is considered "low experience" */
const LOW_EXPERIENCE = 1.5;

/** Continuity threshold below which a team is considered "low continuity" */
const LOW_CONTINUITY = 0.4;

/** Coach tournament appearances threshold below which they're "inexperienced" */
const LOW_COACH_EXPERIENCE = 3;

/** Rounds where conflicts matter (past R64 and R32) */
const DEEP_ROUNDS = new Set(["S16", "E8", "F4", "NCG"]);

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export function leverConflictRule(
  context: GuidanceContext
): GuidanceMessage[] {
  const { picks, teams, globalLevers } = context;
  const messages: GuidanceMessage[] = [];
  const flaggedTeams = new Set<string>();

  for (const [gameId, winnerId] of Object.entries(picks)) {
    let parsed: ReturnType<typeof parseGameId>;
    try {
      parsed = parseGameId(gameId);
    } catch {
      continue;
    }

    if (!DEEP_ROUNDS.has(parsed.round)) continue;
    if (flaggedTeams.has(winnerId)) continue;

    const team = teams.get(winnerId);
    if (!team) continue;

    // Check experience conflict
    if (
      globalLevers.experienceWeight >= HIGH_LEVER_WEIGHT &&
      team.experience < LOW_EXPERIENCE
    ) {
      flaggedTeams.add(winnerId);
      messages.push({
        id: `lever-conflict-experience-${winnerId}`,
        title: `${team.team.shortName}: low experience vs. high experience lever`,
        description:
          `Your experience lever is set to ${globalLevers.experienceWeight.toFixed(1)}x, ` +
          `but ${team.team.shortName} has only ${team.experience.toFixed(1)} years ` +
          `of minutes-weighted D-1 experience. This is below the ${LOW_EXPERIENCE}-year ` +
          `threshold. The model is penalizing inexperienced rosters, yet you are ` +
          `picking this team to advance deep. Consider whether the team's other ` +
          `strengths outweigh the experience gap, or adjust the lever.`,
        severity: "warning",
        category: "lever_conflict",
        gameId,
        teamIds: [winnerId],
      });
    }

    // Check continuity conflict
    if (
      globalLevers.continuityWeight >= HIGH_LEVER_WEIGHT &&
      team.minutesContinuity < LOW_CONTINUITY
    ) {
      if (!flaggedTeams.has(`continuity-${winnerId}`)) {
        flaggedTeams.add(`continuity-${winnerId}`);
        messages.push({
          id: `lever-conflict-continuity-${winnerId}`,
          title: `${team.team.shortName}: low continuity vs. high continuity lever`,
          description:
            `Your continuity lever is set to ${globalLevers.continuityWeight.toFixed(1)}x, ` +
            `but ${team.team.shortName} has only ${Math.round(team.minutesContinuity * 100)}% ` +
            `minutes continuity from last season. Teams with significant roster turnover ` +
            `may lack the cohesion that your lever weights reward.`,
          severity: "warning",
          category: "lever_conflict",
          gameId,
          teamIds: [winnerId],
        });
      }
    }

    // Check coach experience conflict
    if (
      globalLevers.coachExperienceWeight >= HIGH_LEVER_WEIGHT &&
      team.coach.tournamentGames < LOW_COACH_EXPERIENCE
    ) {
      if (!flaggedTeams.has(`coach-${winnerId}`)) {
        flaggedTeams.add(`coach-${winnerId}`);
        messages.push({
          id: `lever-conflict-coach-${winnerId}`,
          title: `${team.team.shortName}: inexperienced coach vs. high coach lever`,
          description:
            `Your coach experience lever is set to ${globalLevers.coachExperienceWeight.toFixed(1)}x, ` +
            `but ${team.team.shortName}'s coach (${team.coach.name}) has only ` +
            `${team.coach.tournamentGames} tournament game(s). The model heavily rewards ` +
            `coaching experience, which may work against this pick.`,
          severity: "warning",
          category: "lever_conflict",
          gameId,
          teamIds: [winnerId],
        });
      }
    }
  }

  return messages;
}
