/**
 * API Route: GET /api/teams
 *
 * Public endpoint for retrieving team data. Supports optional filtering
 * by season and team ID.
 *
 * Query parameters:
 * - `season` (optional): Filter by season year (e.g., 2025)
 * - `teamId` (optional): Filter by specific team UUID
 *
 * Response:
 * - 200: Array of team season records (or placeholder while DB is not connected)
 * - 400: Invalid query parameters
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");
    const teamIdParam = searchParams.get("teamId");

    // --- Validate season if provided ---
    let season: number | undefined;
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

    // TODO: Replace placeholder response with Supabase query once connected.
    //
    // Implementation plan:
    //   1. Import createServerClient from @/lib/supabase
    //   2. Build query: supabase.from("team_seasons").select("*, teams(*), coaches(*)")
    //   3. Apply filters:
    //      - If season is provided: .eq("season", season)
    //      - If teamId is provided: .eq("team_id", teamId)
    //   4. Order by team name or season
    //   5. Transform DB rows to TeamSeason application types
    //   6. Return transformed data

    return NextResponse.json({
      success: true,
      message:
        "Team data endpoint is active but not yet connected to the database. " +
        "Supabase integration will be completed in a subsequent phase.",
      filters: {
        season: season ?? null,
        teamId: teamId ?? null,
      },
      data: {
        teams: [],
        count: 0,
      },
    });
  } catch (error) {
    console.error("Teams fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}
