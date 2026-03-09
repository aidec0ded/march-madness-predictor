/**
 * Rankings utility — computes a team's rank for a given stat
 * among all teams in the tournament field.
 *
 * Rankings are displayed alongside stat values (e.g., "52.6% (11th)")
 * to provide context about where a team stands relative to the field.
 */

import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// Ordinal suffix helper
// ---------------------------------------------------------------------------

/**
 * Returns a number with its ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
 */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------------------
// Stat extraction
// ---------------------------------------------------------------------------

/** A function that extracts a numeric stat value from a TeamSeason */
type StatExtractor = (team: TeamSeason) => number | null;

/**
 * Defines how to extract and rank a particular stat.
 *
 * @prop key - Unique identifier matching the stat label
 * @prop extract - Function to pull the value from a TeamSeason
 * @prop higherIsBetter - Determines sort direction for ranking
 */
interface StatRankDef {
  key: string;
  extract: StatExtractor;
  higherIsBetter: boolean;
}

/**
 * Stat definitions for all stats displayed in the matchup view.
 * The `key` must match the `label` used in buildStatCategories().
 */
const STAT_RANK_DEFS: StatRankDef[] = [
  // Efficiency
  {
    key: "Adj. Off. Efficiency",
    extract: (t) => t.ratings.kenpom?.adjOE ?? null,
    higherIsBetter: true,
  },
  {
    key: "Adj. Def. Efficiency",
    extract: (t) => t.ratings.kenpom?.adjDE ?? null,
    higherIsBetter: false,
  },
  // Four Factors
  {
    key: "eFG% (Off)",
    extract: (t) => t.fourFactorsOffense.efgPct,
    higherIsBetter: true,
  },
  {
    key: "eFG% (Def)",
    extract: (t) => t.fourFactorsDefense.efgPct,
    higherIsBetter: false,
  },
  {
    key: "TO% (Off)",
    extract: (t) => t.fourFactorsOffense.toPct,
    higherIsBetter: false,
  },
  {
    key: "TO% (Def)",
    extract: (t) => t.fourFactorsDefense.toPct,
    higherIsBetter: true,
  },
  {
    key: "ORB% (Off)",
    extract: (t) => t.fourFactorsOffense.orbPct,
    higherIsBetter: true,
  },
  {
    key: "ORB% (Def)",
    extract: (t) => t.fourFactorsDefense.orbPct,
    higherIsBetter: false,
  },
  {
    key: "FT Rate (Off)",
    extract: (t) => t.fourFactorsOffense.ftRate,
    higherIsBetter: true,
  },
  {
    key: "FT Rate (Def)",
    extract: (t) => t.fourFactorsDefense.ftRate,
    higherIsBetter: false,
  },
  // Shooting
  {
    key: "3PT%",
    extract: (t) => t.shootingOffense.threePtPct,
    higherIsBetter: true,
  },
  // Other
  {
    key: "Adj Tempo",
    extract: (t) => t.adjTempo,
    higherIsBetter: true,
  },
  {
    key: "Experience",
    extract: (t) => t.experience,
    higherIsBetter: true,
  },
  {
    key: "Continuity",
    extract: (t) => t.minutesContinuity,
    higherIsBetter: true,
  },
  {
    key: "Avg Height",
    extract: (t) => t.avgHeight,
    higherIsBetter: true,
  },
];

// Build a lookup map for O(1) access by stat key
const STAT_RANK_MAP = new Map(STAT_RANK_DEFS.map((d) => [d.key, d]));

// ---------------------------------------------------------------------------
// Ranking computation
// ---------------------------------------------------------------------------

/**
 * Pre-computes all rankings for every team in the field.
 *
 * Returns a nested Map: teamId → statKey → rank (1-indexed).
 * Call once per render cycle when the team set changes.
 *
 * @param teams - All tournament teams (Map or array)
 * @returns Map from teamId to Map of stat label → rank
 */
export function computeFieldRankings(
  teams: Map<string, TeamSeason> | TeamSeason[]
): Map<string, Map<string, number>> {
  const teamArray = teams instanceof Map ? Array.from(teams.values()) : teams;
  const result = new Map<string, Map<string, number>>();

  // Initialize result map for each team
  for (const team of teamArray) {
    result.set(team.teamId, new Map());
  }

  // For each stat, sort teams and assign ranks
  for (const def of STAT_RANK_DEFS) {
    // Extract values with team references
    const entries: { teamId: string; value: number }[] = [];
    for (const team of teamArray) {
      const value = def.extract(team);
      if (value !== null && isFinite(value)) {
        entries.push({ teamId: team.teamId, value });
      }
    }

    // Sort: best first (rank 1 = best)
    entries.sort((a, b) =>
      def.higherIsBetter ? b.value - a.value : a.value - b.value
    );

    // Assign ranks (handle ties by giving same rank)
    let rank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].value !== entries[i - 1].value) {
        rank = i + 1;
      }
      const teamRanks = result.get(entries[i].teamId);
      if (teamRanks) {
        teamRanks.set(def.key, rank);
      }
    }
  }

  return result;
}

/**
 * Looks up a team's rank for a specific stat.
 *
 * @param rankings - Pre-computed rankings from computeFieldRankings()
 * @param teamId - The team to look up
 * @param statKey - The stat label to look up
 * @returns The rank (1-indexed) or null if not available
 */
export function getTeamRank(
  rankings: Map<string, Map<string, number>>,
  teamId: string,
  statKey: string
): number | null {
  return rankings.get(teamId)?.get(statKey) ?? null;
}

/**
 * Returns the stat rank definition map for external consumers.
 */
export function getStatRankMap(): Map<string, StatRankDef> {
  return STAT_RANK_MAP;
}
