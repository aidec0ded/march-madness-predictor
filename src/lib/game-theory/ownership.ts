/**
 * Game-level ownership model for estimating public pick percentages.
 *
 * Uses NCAA.com historical pick rate data as R64 baselines, then applies
 * modifiers for conference strength, ratings, and brand recognition.
 * Returns game-level ownership that always sums to 100%.
 *
 * Baseline sources (NCAA.com average R64 upset pick rates):
 * - 16 over 1: 1.5%    →  1-seed picked 98.5%
 * - 15 over 2: 7%      →  2-seed picked 93%
 * - 14 over 3: 15%     →  3-seed picked 85%
 * - 13 over 4: 20%     →  4-seed picked 80%
 * - 12 over 5: 36%     →  5-seed picked 64%
 * - 11 over 6: 39%     →  6-seed picked 61%
 * - 10 over 7: ~45%    →  7-seed picked 55%
 * - 9 over 8: ~50%     →  8/9-seed coin flip
 *
 * For non-standard seed pairings (later rounds), the per-seed
 * popularity scores are used proportionally to determine the split.
 */

import type { TeamSeason, TournamentRound } from "@/types/team";
import type { OwnershipEstimate, OwnershipModel } from "@/types/game-theory";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Per-seed public popularity scores derived from NCAA.com R64 pick rates.
 *
 * In R64, each standard pair sums to 17 (1v16, 2v15, etc).
 * The higher seed's pick rate IS the popularity score.
 *
 * For any matchup between seeds s1 and s2:
 *   ownershipA% = popA / (popA + popB) × 100
 *
 * This exactly reproduces the NCAA.com R64 data and gives sensible
 * results for non-standard later-round matchups.
 */
export const SEED_POPULARITY: Record<number, number> = {
  1: 98.5,
  2: 93,
  3: 85,
  4: 80,
  5: 64,
  6: 61,
  7: 55,
  8: 50,
  9: 50,
  10: 45,
  11: 39,
  12: 36,
  13: 20,
  14: 15,
  15: 7,
  16: 1.5,
};

/**
 * Chalk multiplier by round. The public picks more conservatively
 * in later rounds, favoring higher-seeded teams more heavily.
 *
 * Applied to the current favorite's share to boost their ownership.
 */
export const CHALK_MULTIPLIER: Record<TournamentRound, number> = {
  FF: 1.0,
  R64: 1.0,
  R32: 1.05,
  S16: 1.1,
  E8: 1.15,
  F4: 1.2,
  NCG: 1.2,
};

/**
 * Round decay multipliers for single-team estimates.
 *
 * Used only by the per-team `calculateOwnership` fallback, which
 * provides a rough standalone ownership estimate without opponent context.
 */
const ROUND_DECAY: Record<TournamentRound, number> = {
  FF: 1.0,
  R64: 1.0,
  R32: 0.85,
  S16: 0.7,
  E8: 0.55,
  F4: 0.4,
  NCG: 0.3,
};

/**
 * Power conferences — teams from these conferences get an ownership
 * boost when facing non-power conference opponents.
 */
const POWER_CONFERENCES: Set<string> = new Set([
  "ACC",
  "Big 12",
  "Big East",
  "Big Ten",
  "SEC",
]);

/**
 * Schools with outsized public recognition that get extra ownership
 * when facing non-PUBLIC_GROUP opponents.
 */
export const PUBLIC_GROUP: Set<string> = new Set([
  "Duke",
  "Kansas",
  "Kentucky",
  "North Carolina",
  "Connecticut",
  "UCLA",
]);

// Modifier magnitudes (percentage points)
const POWER_CONF_MODIFIER_PP = 4;
const PUBLIC_GROUP_MODIFIER_PP = 2;
const KENPOM_MODIFIER_PER_2PTS = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the team's average adjusted efficiency margin across all
 * available rating sources.
 */
function getAvgAdjEM(team: TeamSeason): number {
  const margins: number[] = [];
  if (team.ratings.kenpom) margins.push(team.ratings.kenpom.adjEM);
  if (team.ratings.torvik) margins.push(team.ratings.torvik.adjEM);
  if (team.ratings.evanmiya) margins.push(team.ratings.evanmiya.adjEM);
  if (margins.length === 0) return 0;
  return margins.reduce((sum, m) => sum + m, 0) / margins.length;
}

/**
 * Calculates the total modifier (in percentage points) that shifts
 * ownership toward teamA and away from teamB.
 *
 * Positive result = teamA gets boosted, negative = teamB gets boosted.
 * Modifiers only apply when there's a differential between the teams.
 *
 * Modifiers:
 * - Power conference vs non-power opponent: +4pp
 * - PUBLIC_GROUP vs non-PUBLIC_GROUP opponent: +2pp
 * - KenPom AdjEM advantage: +1pp per 2 points of AdjEM differential
 */
function calculateModifiers(teamA: TeamSeason, teamB: TeamSeason): number {
  let modifier = 0;

  // Power conference modifier: only when one is power and other isn't
  const aPower = POWER_CONFERENCES.has(teamA.team.conference);
  const bPower = POWER_CONFERENCES.has(teamB.team.conference);
  if (aPower && !bPower) modifier += POWER_CONF_MODIFIER_PP;
  if (bPower && !aPower) modifier -= POWER_CONF_MODIFIER_PP;

  // PUBLIC_GROUP modifier: only when one is in the group and other isn't
  const aPublic = PUBLIC_GROUP.has(teamA.team.name);
  const bPublic = PUBLIC_GROUP.has(teamB.team.name);
  if (aPublic && !bPublic) modifier += PUBLIC_GROUP_MODIFIER_PP;
  if (bPublic && !aPublic) modifier -= PUBLIC_GROUP_MODIFIER_PP;

  // KenPom AdjEM modifier: +1pp per 2 points of advantage
  const emA = getAvgAdjEM(teamA);
  const emB = getAvgAdjEM(teamB);
  const emDiff = emA - emB;
  modifier += (emDiff / 2) * KENPOM_MODIFIER_PER_2PTS;

  return modifier;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates game-level ownership for a matchup between two teams.
 *
 * Returns [ownershipA, ownershipB] as percentages that always sum to 100.
 *
 * Steps:
 * 1. Seed-based baseline from NCAA.com data (proportional popularity split)
 * 2. Modifiers shift ownership (conference, ratings, brand recognition)
 * 3. Chalk multiplier boosts the favorite in later rounds
 * 4. Clamped to [1, 99] to ensure valid percentages
 *
 * @param teamA - First team in the matchup
 * @param teamB - Second team in the matchup
 * @param round - The tournament round
 * @returns [ownershipA, ownershipB] summing to 100
 */
export function calculateMatchupOwnership(
  teamA: TeamSeason,
  teamB: TeamSeason,
  round: TournamentRound
): [number, number] {
  const seedA = teamA.tournamentEntry?.seed ?? 8;
  const seedB = teamB.tournamentEntry?.seed ?? 8;

  // Step 1: Seed-based baseline (proportional split from popularity scores)
  let pctA: number;
  if (round === "FF") {
    // First Four: start at 50/50 before modifiers
    pctA = 50;
  } else {
    const popA = SEED_POPULARITY[seedA] ?? 50;
    const popB = SEED_POPULARITY[seedB] ?? 50;
    const totalPop = popA + popB;
    pctA = totalPop > 0 ? (popA / totalPop) * 100 : 50;
  }

  // Step 2: Apply modifiers (positive = boost teamA)
  pctA += calculateModifiers(teamA, teamB);

  // Step 3: Apply chalk multiplier for later rounds
  const chalkMult = CHALK_MULTIPLIER[round];
  if (chalkMult !== 1.0) {
    if (pctA >= 50) {
      // teamA is the favorite — boost their share
      pctA = pctA * chalkMult;
    } else {
      // teamB is the favorite — boost their share
      const pctB = 100 - pctA;
      pctA = 100 - pctB * chalkMult;
    }
  }

  // Step 4: Clamp to [1, 99] — always sum to 100
  pctA = Math.max(1, Math.min(99, pctA));

  return [pctA, 100 - pctA];
}

/**
 * Single-team ownership estimate without opponent context.
 *
 * Uses seed popularity with round decay as a rough standalone metric.
 * For accurate game-level ownership, use calculateMatchupOwnership instead.
 *
 * @param team - The team season data
 * @param round - The tournament round
 * @returns Estimated ownership percentage (1-99)
 */
export function calculateOwnership(
  team: TeamSeason,
  round: TournamentRound
): number {
  const seed = team.tournamentEntry?.seed ?? 8;
  const baseline = SEED_POPULARITY[seed] ?? 50;
  const decay = ROUND_DECAY[round];
  return Math.max(1, Math.min(99, baseline * decay));
}

/**
 * Builds a complete ownership model for all teams.
 *
 * Stores team data for on-demand game-level calculations via
 * `getMatchupOwnership`. Also pre-computes per-team standalone estimates
 * for backward compatibility via `getOwnership`.
 *
 * @param teams - All tournament teams (typically 64-68)
 * @returns An OwnershipModel with both per-team and game-level lookups
 */
export function buildFullOwnershipModel(teams: TeamSeason[]): OwnershipModel {
  const teamMap = new Map<string, TeamSeason>();
  const estimates = new Map<string, OwnershipEstimate>();
  const rounds: TournamentRound[] = ["R64", "R32", "S16", "E8", "F4", "NCG"];

  for (const team of teams) {
    if (!team.tournamentEntry) continue;
    teamMap.set(team.teamId, team);

    // Pre-compute per-team standalone estimates (backward compat)
    for (const round of rounds) {
      const ownershipPct = calculateOwnership(team, round);
      const key = `${team.teamId}-${round}`;
      estimates.set(key, { teamId: team.teamId, round, ownershipPct });
    }
  }

  return {
    estimates,

    getOwnership: (teamId: string, round: TournamentRound): number => {
      const key = `${teamId}-${round}`;
      return estimates.get(key)?.ownershipPct ?? 0;
    },

    getMatchupOwnership: (
      teamAId: string,
      teamBId: string,
      round: TournamentRound
    ): [number, number] => {
      const teamA = teamMap.get(teamAId);
      const teamB = teamMap.get(teamBId);
      if (!teamA || !teamB) return [50, 50];
      return calculateMatchupOwnership(teamA, teamB, round);
    },
  };
}
