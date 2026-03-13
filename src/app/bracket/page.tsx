/**
 * Bracket Page — Server Component
 *
 * Fetches tournament team data and the user's active bracket from Supabase,
 * then renders the BracketShell client component with the data.
 *
 * Data flow:
 * 1. Fetch all team_seasons for the current season (joined with teams + coaches)
 * 2. Fetch tournament_entries for seeding/region data
 * 3. Transform DB rows into TeamSeason application types
 * 4. Filter to tournament teams only
 * 5. Optionally load user's active saved bracket
 * 6. Pass everything to BracketShell for client-side interactivity
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerClient, createAdminClient } from "@/lib/supabase/client";
import { transformTeamSeasonRows } from "@/lib/supabase/transforms";
import { processTournamentField } from "@/lib/bracket-utils";
import type { TournamentSite, TournamentRound, Region } from "@/types/team";

export const metadata: Metadata = {
  title: "Bracket Builder",
  description:
    "Build and simulate your March Madness bracket with Monte Carlo probabilities and game theory strategy.",
  openGraph: {
    title: "Bracket Builder | Predict the Madness",
    description:
      "Build and simulate your bracket with Monte Carlo probabilities and contest-aware strategy.",
  },
};
import type { TeamSeasonJoinedRow } from "@/lib/supabase/transforms";
import type {
  TournamentSiteRow,
  UserBracketRow,
} from "@/lib/supabase/types";
import { BracketShell } from "@/components/bracket/BracketShell";
import { DEFAULT_GLOBAL_LEVERS } from "@/types/engine";
import type { MatchupOverrides } from "@/types/engine";
import type { SavedBracketData } from "@/types/bracket-ui";
import { deserializeGlobalLevers } from "@/lib/engine/lever-serialization";
import type { SimulationResult } from "@/types/simulation";
import { CURRENT_SEASON } from "@/lib/constants";

export default async function BracketPage() {
  // Use admin client for public team data (RLS requires authenticated role)
  const adminClient = createAdminClient();

  // Fetch tournament teams for current season
  const { data: teamSeasonRows, error: teamsError } = await adminClient
    .from("team_seasons")
    .select("*, teams!inner(*), coaches(*)")
    .eq("season", CURRENT_SEASON)
    .returns<TeamSeasonJoinedRow[]>();

  // Fetch tournament entries
  const { data: entries, error: entriesError } = await adminClient
    .from("tournament_entries")
    .select("*")
    .eq("season", CURRENT_SEASON);

  // Fetch tournament sites (optional — graceful degradation if none exist)
  const { data: sitesRows, error: sitesError } = await adminClient
    .from("tournament_sites")
    .select("*")
    .eq("season", CURRENT_SEASON);

  // Transform site rows to TournamentSite[]
  let tournamentSites: TournamentSite[] | undefined;
  if (sitesRows && sitesRows.length > 0) {
    tournamentSites = (sitesRows as TournamentSiteRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      latitude: row.latitude,
      longitude: row.longitude,
      rounds: row.rounds as TournamentRound[],
      regions: row.regions ? (row.regions as Region[]) : undefined,
      season: row.season,
    }));
  }

  if (teamsError || entriesError || !teamSeasonRows || !entries) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: "32px",
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Unable to load bracket data
        </h2>
        <p style={{ fontSize: "0.875rem", maxWidth: "400px" }}>
          {teamsError?.message ||
            entriesError?.message ||
            `No team data available for the ${CURRENT_SEASON} season. Please ensure tournament data has been imported.`}
        </p>
      </div>
    );
  }

  // Transform and process tournament field (supports 64 or 68 teams)
  const allTeams = transformTeamSeasonRows(
    teamSeasonRows ?? [],
    entries ?? []
  );
  const allTournamentTeams = allTeams.filter((t) => t.tournamentEntry);
  const { teams: tournamentTeams, playInConfig } = processTournamentField(allTournamentTeams);

  // Optionally load user's active bracket (needs cookie-based client for auth)
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let savedBracket: SavedBracketData | undefined;
  if (user) {
    const { data: brackets } = await supabase
      .from("user_brackets")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("season", CURRENT_SEASON)
      .limit(1);

    if (brackets && brackets.length > 0) {
      const b = brackets[0] as UserBracketRow;
      // Restore saved lever state, falling back to defaults for old brackets
      // that were saved before the global_levers column existed
      const hasLevers = b.global_levers && Object.keys(b.global_levers).length > 0;
      const globalLevers = hasLevers
        ? deserializeGlobalLevers(b.global_levers as Record<string, unknown>)
        : { ...DEFAULT_GLOBAL_LEVERS };
      const matchupOverrides = (b.matchup_overrides && Object.keys(b.matchup_overrides).length > 0)
        ? (b.matchup_overrides as Record<string, MatchupOverrides>)
        : {};

      savedBracket = {
        bracketId: b.id,
        name: b.name,
        picks: (b.picks || {}) as Record<string, string>,
        globalLevers,
        matchupOverrides,
        simulationSnapshot:
          (b.simulation_snapshot as unknown as SimulationResult) ?? null,
      };
    }
  }

  return (
    <BracketShell
      initialTeams={tournamentTeams}
      savedBracket={savedBracket}
      tournamentSites={tournamentSites}
      playInConfig={playInConfig}
    />
  );
}
