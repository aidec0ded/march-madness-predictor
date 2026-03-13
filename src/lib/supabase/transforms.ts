/**
 * Database row → application type transformers.
 *
 * Converts raw Supabase query results (snake_case DB rows with nullable fields)
 * into the strongly-typed camelCase application types used by the simulation engine.
 *
 * The primary export is `transformTeamSeasonRows`, which takes joined team_seasons
 * rows (with teams and coaches) plus a separate tournament_entries array and produces
 * fully-hydrated TeamSeason objects ready for the simulation engine.
 */

import type {
  TeamSeason,
  Team,
  Conference,
  CoachRecord,
  EfficiencyRatings,
  FourFactors,
  ShootingSplits,
  TournamentEntry,
  DataSource,
  Seed,
  Region,
} from "@/types/team";

import type {
  TeamSeasonRow,
  TeamRow,
  CoachRow,
  TournamentEntryRow,
} from "./types";

// ---------------------------------------------------------------------------
// Joined row types (what Supabase returns from .select("*, teams(*), coaches(*)"))
// ---------------------------------------------------------------------------

/**
 * Shape returned by Supabase when querying team_seasons with
 * `.select("*, teams!inner(*), coaches(*)")`.
 *
 * The `teams` join is always present (inner join), while `coaches` may be null
 * if the team_season has no coach_id set.
 */
export interface TeamSeasonJoinedRow extends TeamSeasonRow {
  teams: TeamRow;
  coaches: CoachRow | null;
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

/**
 * Safely coerce a nullable number to a non-null number, defaulting to 0.
 */
function num(value: number | null | undefined): number {
  return value ?? 0;
}

/**
 * Build a Team object from a teams DB row.
 */
function transformTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    conference: row.conference as Conference,
    campus: {
      city: row.campus_city,
      state: row.campus_state,
      latitude: row.campus_lat,
      longitude: row.campus_lng,
    },
  };
}

/**
 * Build a CoachRecord from a coaches DB row.
 * If no coach data is available, returns a default "Unknown" coach record.
 */
function transformCoach(row: CoachRow | null): CoachRecord {
  if (!row) {
    return {
      name: "Unknown",
      tournamentGames: 0,
      tournamentWins: 0,
      finalFours: 0,
      championships: 0,
      yearsHeadCoach: 0,
    };
  }

  return {
    name: row.name,
    tournamentGames: num(row.tournament_games),
    tournamentWins: num(row.tournament_wins),
    finalFours: num(row.final_fours),
    championships: num(row.championships),
    yearsHeadCoach: num(row.years_head_coach),
  };
}

/**
 * Build efficiency ratings for a given data source from the team_season row.
 * Returns undefined if the source has no data (all three fields null).
 */
function buildEfficiencyRatings(
  row: TeamSeasonRow,
  source: DataSource
): EfficiencyRatings | undefined {
  let adjOE: number | null;
  let adjDE: number | null;
  let adjEM: number | null;

  switch (source) {
    case "kenpom":
      adjOE = row.kenpom_adj_oe;
      adjDE = row.kenpom_adj_de;
      adjEM = row.kenpom_adj_em;
      break;
    case "torvik":
      adjOE = row.torvik_adj_oe;
      adjDE = row.torvik_adj_de;
      adjEM = row.torvik_adj_em;
      break;
    case "evanmiya":
      adjOE = row.evanmiya_adj_oe;
      adjDE = row.evanmiya_adj_de;
      adjEM = row.evanmiya_adj_em;
      break;
  }

  // If all three values are null, this source has no data
  if (adjOE === null && adjDE === null && adjEM === null) {
    return undefined;
  }

  return {
    source,
    adjOE: num(adjOE),
    adjDE: num(adjDE),
    adjEM: num(adjEM),
  };
}

/**
 * Build offensive FourFactors from the team_season row.
 */
function buildFourFactorsOffense(row: TeamSeasonRow): FourFactors {
  return {
    efgPct: num(row.off_efg_pct),
    toPct: num(row.off_to_pct),
    orbPct: num(row.off_orb_pct),
    ftRate: num(row.off_ft_rate),
  };
}

/**
 * Build defensive FourFactors from the team_season row.
 * Returns null when all four fields are null (data not loaded).
 */
function buildFourFactorsDefense(row: TeamSeasonRow): FourFactors | null {
  if (
    row.def_efg_pct === null &&
    row.def_to_pct === null &&
    row.def_orb_pct === null &&
    row.def_ft_rate === null
  ) {
    return null;
  }
  return {
    efgPct: num(row.def_efg_pct),
    toPct: num(row.def_to_pct),
    orbPct: num(row.def_orb_pct),
    ftRate: num(row.def_ft_rate),
  };
}

/**
 * Build offensive ShootingSplits from the team_season row.
 */
function buildShootingOffense(row: TeamSeasonRow): ShootingSplits {
  return {
    threePtPct: num(row.off_three_pt_pct),
    threePtRate: num(row.off_three_pt_rate),
    ftPct: num(row.off_ft_pct),
  };
}

/**
 * Build defensive ShootingSplits from the team_season row.
 * Returns null when all three fields are null (data not loaded).
 */
function buildShootingDefense(row: TeamSeasonRow): ShootingSplits | null {
  if (
    row.def_three_pt_pct === null &&
    row.def_three_pt_rate === null &&
    row.def_ft_pct === null
  ) {
    return null;
  }
  return {
    threePtPct: num(row.def_three_pt_pct),
    threePtRate: num(row.def_three_pt_rate),
    ftPct: num(row.def_ft_pct),
  };
}

/**
 * Build a TournamentEntry from a tournament_entries DB row.
 */
function transformTournamentEntry(row: TournamentEntryRow): TournamentEntry {
  return {
    seed: row.seed as Seed,
    region: row.region as Region,
    bracketPosition: row.bracket_position,
  };
}

// ---------------------------------------------------------------------------
// Main transform function
// ---------------------------------------------------------------------------

/**
 * Transforms an array of joined team_season DB rows into TeamSeason application objects.
 *
 * Handles:
 * - Mapping snake_case DB columns to camelCase TypeScript fields
 * - Building the Team object from the joined teams data
 * - Building the CoachRecord from the joined coaches data (with fallback for null)
 * - Building EfficiencyRatings for each data source that has values
 * - Building FourFactors and ShootingSplits objects
 * - Defaulting null numeric fields to 0
 * - Attaching TournamentEntry data if available
 *
 * @param rows - Array of team_season rows with joined teams and coaches data
 * @param tournamentEntries - Array of tournament_entries rows for the same season
 * @returns Array of fully-hydrated TeamSeason objects
 */
export function transformTeamSeasonRows(
  rows: TeamSeasonJoinedRow[],
  tournamentEntries: TournamentEntryRow[] = []
): TeamSeason[] {
  // Build a lookup from team_season_id → tournament entry
  const entryByTeamSeasonId = new Map<string, TournamentEntryRow>();
  for (const entry of tournamentEntries) {
    entryByTeamSeasonId.set(entry.team_season_id, entry);
  }

  return rows.map((row) => {
    // Build efficiency ratings (only include sources that have data)
    const kenpom = buildEfficiencyRatings(row, "kenpom");
    const torvik = buildEfficiencyRatings(row, "torvik");
    const evanmiya = buildEfficiencyRatings(row, "evanmiya");

    const ratings: TeamSeason["ratings"] = {};
    if (kenpom) ratings.kenpom = kenpom;
    if (torvik) ratings.torvik = torvik;
    if (evanmiya) ratings.evanmiya = evanmiya;

    // Look up tournament entry
    const entryRow = entryByTeamSeasonId.get(row.id);
    const tournamentEntry = entryRow
      ? transformTournamentEntry(entryRow)
      : undefined;

    const teamSeason: TeamSeason = {
      id: row.id,
      teamId: row.team_id,
      season: row.season,

      team: transformTeam(row.teams),
      coach: transformCoach(row.coaches),

      ratings,

      fourFactorsOffense: buildFourFactorsOffense(row),
      fourFactorsDefense: buildFourFactorsDefense(row),

      shootingOffense: buildShootingOffense(row),
      shootingDefense: buildShootingDefense(row),

      adjTempo: num(row.adj_tempo),
      avgPossLengthOff: num(row.avg_poss_length_off),
      avgPossLengthDef: num(row.avg_poss_length_def),

      benchMinutesPct: num(row.bench_minutes_pct),
      experience: num(row.experience),
      minutesContinuity: num(row.minutes_continuity),
      avgHeight: num(row.avg_height),

      twoFoulParticipation: num(row.two_foul_participation),

      sosNetRating: num(row.sos_net_rating),
      sosOffRating: num(row.sos_off_rating),
      sosDefRating: num(row.sos_def_rating),
      luck: num(row.luck),

      evanmiyaOpponentAdjust: num(row.evanmiya_opponent_adjust),
      evanmiyaPaceAdjust: num(row.evanmiya_pace_adjust),
      evanmiyaKillShotsPerGame: num(row.evanmiya_kill_shots_per_game),
      evanmiyaKillShotsAllowedPerGame: num(row.evanmiya_kill_shots_allowed_per_game),
      evanmiyaKillShotsMargin: num(row.evanmiya_kill_shots_margin),

      tournamentEntry,

      updatedAt: row.updated_at,
      dataSources: (row.data_sources ?? []) as DataSource[],
    };

    return teamSeason;
  });
}
