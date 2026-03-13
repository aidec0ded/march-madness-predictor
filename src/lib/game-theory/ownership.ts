/**
 * Ownership model for estimating public pick percentages.
 *
 * Uses a heuristic approach based on:
 * - Seed-based baseline ownership (historically, higher seeds are picked more)
 * - Round decay (ownership drops as rounds advance — fewer people pick a team deep)
 * - Conference premium (power conference teams get a slight bump)
 * - Rating strength (teams rated higher than seed-average get an ownership bump)
 *
 * This is a heuristic model, not derived from real ownership data. It provides
 * a reasonable approximation for game theory recommendations.
 */

import type { TeamSeason, TournamentRound, Seed, Conference } from "@/types/team";
import type { OwnershipEstimate, OwnershipModel } from "@/types/game-theory";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Seed-based R64 ownership baseline (percentage).
 * Represents the estimated % of brackets that pick this seed to win their R64 game.
 * These are rough historical averages of public bracket tendencies.
 */
export const SEED_BASELINES: Record<number, number> = {
  1: 98,
  2: 93,
  3: 85,
  4: 78,
  5: 65,
  6: 60,
  7: 55,
  8: 50,
  9: 50,
  10: 45,
  11: 40,
  12: 35,
  13: 15,
  14: 10,
  15: 5,
  16: 2,
};

/**
 * Round decay multipliers.
 * Applied to the seed baseline to estimate how many brackets pick a team
 * to reach each successive round. Decay is multiplicative because each
 * round requires surviving the previous round.
 */
export const ROUND_DECAY: Record<TournamentRound, number> = {
  FF: 1.0,
  R64: 1.0,
  R32: 0.85,
  S16: 0.7,
  E8: 0.55,
  F4: 0.4,
  NCG: 0.3,
};

/**
 * Power conferences that get a slight ownership premium.
 * The public over-picks familiar blue-blood programs from major conferences.
 */
const POWER_CONFERENCES: Set<string> = new Set([
  "ACC",
  "Big 12",
  "Big East",
  "Big Ten",
  "SEC",
]);

/** Ownership premium (percentage points) for power conference teams */
const POWER_CONFERENCE_PREMIUM = 4;

/** Ownership premium (percentage points) for mid-major "brand name" conferences */
const MID_MAJOR_PREMIUM_CONFERENCES: Set<string> = new Set([
  "WCC",
  "AAC",
  "MWC",
  "A-10",
]);
const MID_MAJOR_PREMIUM = 1.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates the conference premium for a team's conference.
 *
 * @param conference - The team's conference
 * @returns Ownership percentage point adjustment
 */
function getConferencePremium(conference: string): number {
  if (POWER_CONFERENCES.has(conference)) return POWER_CONFERENCE_PREMIUM;
  if (MID_MAJOR_PREMIUM_CONFERENCES.has(conference)) return MID_MAJOR_PREMIUM;
  return 0;
}

/**
 * Calculates a rating-strength adjustment based on how the team's composite
 * efficiency margin compares to the typical margin for their seed.
 *
 * Teams with better ratings than expected for their seed get an ownership bump
 * because the public tends to favor teams that "look strong" in previews.
 *
 * @param team - The team season data
 * @returns Ownership percentage point adjustment (-3 to +5)
 */
function getRatingStrengthAdjustment(team: TeamSeason): number {
  // Get the team's best available efficiency margin
  const margins: number[] = [];
  if (team.ratings.kenpom) margins.push(team.ratings.kenpom.adjEM);
  if (team.ratings.torvik) margins.push(team.ratings.torvik.adjEM);
  if (team.ratings.evanmiya) margins.push(team.ratings.evanmiya.adjEM);

  if (margins.length === 0) return 0;

  const avgMargin = margins.reduce((sum, m) => sum + m, 0) / margins.length;

  // Expected margin by seed (rough heuristic based on historical data)
  // 1-seed: ~+28, 16-seed: ~-10, linear interpolation
  const seed = team.tournamentEntry?.seed ?? 8;
  const expectedMargin = 28 - (seed - 1) * 2.53; // ~28 for 1-seed, ~-10 for 16-seed

  const delta = avgMargin - expectedMargin;

  // Clamp adjustment: max +5, min -3
  return Math.max(-3, Math.min(5, delta * 0.5));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates the estimated public ownership percentage for a team in a given round.
 *
 * The formula is:
 *   ownership = clamp(seedBaseline × roundDecay + conferencePremium + ratingAdj, 0, 100)
 *
 * @param team - The team season data (must have tournamentEntry)
 * @param round - The tournament round
 * @returns Estimated ownership percentage (0-100)
 */
export function calculateOwnership(
  team: TeamSeason,
  round: TournamentRound
): number {
  const seed = team.tournamentEntry?.seed ?? 8;
  const baseline = SEED_BASELINES[seed] ?? 50;
  const decay = ROUND_DECAY[round];
  const confPremium = getConferencePremium(team.team.conference);
  const ratingAdj = getRatingStrengthAdjustment(team);

  const raw = baseline * decay + confPremium + ratingAdj;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, raw));
}

/**
 * Builds a complete ownership model for all teams across all rounds.
 *
 * Creates a lookup map keyed by `${teamId}-${round}` and provides a
 * convenience getter function.
 *
 * @param teams - All tournament teams (typically 64)
 * @returns An OwnershipModel with pre-computed estimates
 */
export function buildFullOwnershipModel(teams: TeamSeason[]): OwnershipModel {
  const estimates = new Map<string, OwnershipEstimate>();
  const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];

  for (const team of teams) {
    if (!team.tournamentEntry) continue;

    for (const round of rounds) {
      const ownershipPct = calculateOwnership(team, round);
      const key = `${team.teamId}-${round}`;
      estimates.set(key, {
        teamId: team.teamId,
        round,
        ownershipPct,
      });
    }
  }

  return {
    estimates,
    getOwnership: (teamId: string, round: TournamentRound): number => {
      const key = `${teamId}-${round}`;
      return estimates.get(key)?.ownershipPct ?? 0;
    },
  };
}
