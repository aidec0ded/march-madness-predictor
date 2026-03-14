/**
 * API Route: GET /api/teams
 *
 * Public endpoint for retrieving team data from Supabase. Supports optional
 * filtering by season and team ID. Returns fully-hydrated TeamSeason objects
 * with joined team, coach, and tournament entry data.
 *
 * Query parameters:
 * - `season` (optional): Filter by season year. Defaults to CURRENT_SEASON.
 * - `teamId` (optional): Filter by specific team UUID
 * - `tournamentOnly` (optional): If "true", returns only teams with tournament entries
 *
 * Response:
 * - 200: Array of TeamSeason objects
 * - 400: Invalid query parameters
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/client";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import {
  transformTeamSeasonRows,
  type TeamSeasonJoinedRow,
} from "@/lib/supabase/transforms";
import type { TournamentEntryRow } from "@/lib/supabase/types";
import { CURRENT_SEASON } from "@/lib/constants";

const rateLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

export async function GET(request: Request) {
  try {
    // --- Rate limit ---
    const clientIp = getClientIp(request);
    const rl = rateLimiter.check(clientIp);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(rl.remaining),
            "X-RateLimit-Reset": String(rl.resetAt),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");
    const teamIdParam = searchParams.get("teamId");
    const tournamentOnlyParam = searchParams.get("tournamentOnly");

    // --- Validate season if provided ---
    let season: number = CURRENT_SEASON;
    if (seasonParam !== null) {
      season = parseInt(seasonParam, 10);
      if (!Number.isInteger(season) || season < 2000 || season > 2100) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid season parameter. Must be an integer between 2000 and 2100.",
          },
          { status: 400 }
        );
      }
    }

    // --- Validate teamId format if provided ---
    let teamId: string | undefined;
    if (teamIdParam !== null) {
      // Basic UUID format check (loose — accepts most UUID variants)
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(teamIdParam)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid teamId parameter. Must be a valid UUID.",
          },
          { status: 400 }
        );
      }
      teamId = teamIdParam;
    }

    const tournamentOnly = tournamentOnlyParam === "true";

    // --- Query Supabase ---
    const supabase = createPublicClient();

    // Build team_seasons query with joins to teams and coaches
    let teamQuery = supabase
      .from("team_seasons")
      .select("*, teams!inner(*), coaches(*)")
      .eq("season", season);

    if (teamId) {
      teamQuery = teamQuery.eq("team_id", teamId);
    }

    const { data: teamSeasonRows, error: teamsError } = await teamQuery
      .returns<TeamSeasonJoinedRow[]>();

    if (teamsError) {
      logger.error(
        "Teams API: failed to fetch team_seasons",
        new Error(teamsError.message)
      );
      return NextResponse.json(
        { success: false, error: "Failed to fetch team data." },
        { status: 500 }
      );
    }

    // Fetch tournament entries for the same season
    const { data: entries, error: entriesError } = await supabase
      .from("tournament_entries")
      .select("*")
      .eq("season", season)
      .returns<TournamentEntryRow[]>();

    if (entriesError) {
      logger.warn("Teams API: failed to fetch tournament_entries", {
        error: entriesError.message,
      });
      // Non-fatal: proceed without tournament data
    }

    // --- Transform DB rows to application types ---
    const allTeams = transformTeamSeasonRows(
      teamSeasonRows ?? [],
      entries ?? []
    );

    // Optionally filter to tournament teams only
    const teams = tournamentOnly
      ? allTeams.filter((t) => t.tournamentEntry)
      : allTeams;

    return NextResponse.json({
      success: true,
      data: {
        teams,
        count: teams.length,
        season,
        filters: {
          teamId: teamId ?? null,
          tournamentOnly,
        },
      },
    });
  } catch (error) {
    logger.error("Teams fetch error", error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred while fetching teams.",
      },
      { status: 500 }
    );
  }
}
