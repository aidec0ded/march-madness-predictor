/**
 * Shared data-fetching logic for bracket simulation routes.
 *
 * Both `/api/simulate` and `/api/simulate/stream` need identical Supabase
 * queries to load team seasons, tournament entries, and tournament sites.
 * This module extracts that duplicated logic into a single function.
 */

import { createPublicClient } from "@/lib/supabase/client";
import { transformTeamSeasonRows } from "@/lib/supabase/transforms";
import type { TeamSeasonJoinedRow } from "@/lib/supabase/transforms";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import { buildSiteMap } from "@/lib/engine/site-mapping";
import type { SiteMap } from "@/lib/engine/site-mapping";
import { processTournamentField } from "@/lib/bracket-utils";
import type { TeamSeason, TournamentSite, TournamentRound, Region } from "@/types/team";
import type { TournamentEntryRow, TournamentSiteRow } from "@/lib/supabase/types";
import type { PlayInConfig } from "@/types/simulation";
import { logger } from "@/lib/logger";

export interface SimulationData {
  teamsMap: Map<string, TeamSeason>;
  playInConfig: PlayInConfig | null;
  siteMap: SiteMap | undefined;
}

export interface SimulationDataError {
  message: string;
  status: number;
}

/**
 * Fetches and processes all data needed to run a bracket simulation.
 * Shared between the standard and streaming simulate routes.
 */
export async function fetchSimulationData(
  season: number
): Promise<{ data: SimulationData } | { error: SimulationDataError }> {
  const supabase = createPublicClient();

  // Fetch team_seasons
  const { data: teamSeasonRows, error: teamSeasonsError } = await supabase
    .from("team_seasons")
    .select("*, teams!inner(*), coaches(*)")
    .eq("season", season)
    .order("team_id")
    .returns<TeamSeasonJoinedRow[]>();

  if (teamSeasonsError) {
    logger.error("Error fetching team seasons", teamSeasonsError);
    return { error: { message: "Failed to fetch team data. Please try again.", status: 500 } };
  }

  if (!teamSeasonRows || teamSeasonRows.length === 0) {
    return { error: { message: `No team data found for season ${season}.`, status: 404 } };
  }

  // Fetch tournament entries
  const { data: tournamentEntries, error: entriesError } = await supabase
    .from("tournament_entries")
    .select("*")
    .eq("season", season)
    .returns<TournamentEntryRow[]>();

  if (entriesError) {
    logger.error("Error fetching tournament entries", entriesError);
    return { error: { message: "Failed to fetch tournament entries. Please try again.", status: 500 } };
  }

  if (!tournamentEntries || tournamentEntries.length === 0) {
    return {
      error: {
        message: `No tournament entries found for season ${season}. The bracket may not have been set yet.`,
        status: 404,
      },
    };
  }

  // Fetch tournament sites (optional — graceful degradation)
  const { data: sitesRows } = await supabase
    .from("tournament_sites")
    .select("*")
    .eq("season", season);

  // Transform
  const allTeamSeasons = transformTeamSeasonRows(teamSeasonRows, tournamentEntries);
  const allTournamentTeams = allTeamSeasons.filter(
    (ts): ts is TeamSeason & { tournamentEntry: NonNullable<TeamSeason["tournamentEntry"]> } =>
      ts.tournamentEntry !== undefined
  );

  const { teams: tournamentTeams, playInConfig } = processTournamentField(allTournamentTeams);

  // Validate team count
  const expectedCount = playInConfig ? 68 : 64;
  if (tournamentTeams.length !== expectedCount) {
    return {
      error: {
        message: `Expected ${expectedCount} tournament teams for season ${season}, but found ${tournamentTeams.length}. The bracket data may be incomplete.`,
        status: 400,
      },
    };
  }

  // Build site map
  let siteMap: SiteMap | undefined;
  if (sitesRows && sitesRows.length > 0) {
    const sites: TournamentSite[] = (sitesRows as TournamentSiteRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
      rounds: row.rounds as TournamentRound[],
      regions: row.regions ? (row.regions as Region[]) : undefined,
      seedMatchups: row.seed_matchups ?? undefined,
      season: row.season,
    }));
    const matchups = buildBracketMatchups(playInConfig);
    siteMap = buildSiteMap(matchups, sites);
  }

  // Build teams map
  const teamsMap = new Map<string, TeamSeason>();
  for (const team of tournamentTeams) {
    teamsMap.set(team.teamId, team);
  }

  return { data: { teamsMap, playInConfig, siteMap } };
}
