/**
 * API Route: POST /api/admin/import/evanmiya/commit
 *
 * "Confirm & Save to Database" endpoint for the Evan Miya CSV import
 * pipeline. Receives validated + normalized team data from the preview step
 * (POST /api/admin/import/evanmiya) and upserts it into Supabase.
 *
 * Request body:
 * ```json
 * {
 *   "season": 2026,
 *   "teams": [ ... array of Partial<TeamSeason> objects ... ]
 * }
 * ```
 *
 * Response:
 * - 200: Successful upsert (includes counts of teams/seasons upserted)
 * - 400: Invalid request body (missing fields, bad season, empty teams)
 * - 401: Missing or invalid admin API key
 * - 429: Rate limit exceeded
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth/admin-check";
import { createAdminClient } from "@/lib/supabase/client";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getCampusLocation } from "@/lib/data/campus-locations";
import {
  nanToNull,
  generateShortName,
  upsertTeams,
  upsertTeamSeasons,
  upsertNameMappings,
  recordImportJob,
  resolveCanonicalTeamNames,
} from "@/lib/data/upsert-helpers";
import type { TeamUpsertRecord } from "@/lib/data/upsert-helpers";
import type { TeamSeason } from "@/types";

// ---------------------------------------------------------------------------
// Rate limiter — 5 requests per 60 seconds
// ---------------------------------------------------------------------------

const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // --- Auth check ---
  if (!(await isAdmin(request))) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Provide a valid x-admin-key header.",
      },
      { status: 401 }
    );
  }

  // --- Rate limit ---
  const clientIp = getClientIp(request);
  const rateLimitResult = limiter.check(clientIp);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Rate limit exceeded. Try again later.",
      },
      { status: 429 }
    );
  }

  try {
    // --- Parse request body ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const { season, teams } = body as { season?: unknown; teams?: unknown };

    // --- Validate season ---
    if (season === undefined || season === null) {
      return NextResponse.json(
        { success: false, error: "Missing required field: season." },
        { status: 400 }
      );
    }

    const seasonNum =
      typeof season === "string" ? parseInt(season, 10) : Number(season);
    if (!Number.isInteger(seasonNum) || seasonNum < 2000 || seasonNum > 2100) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid season. Must be an integer between 2000 and 2100.",
        },
        { status: 400 }
      );
    }

    // --- Validate teams array ---
    if (!teams) {
      return NextResponse.json(
        { success: false, error: "Missing required field: teams." },
        { status: 400 }
      );
    }

    if (!Array.isArray(teams)) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'teams' must be an array of normalized team objects.",
        },
        { status: 400 }
      );
    }

    if (teams.length === 0) {
      return NextResponse.json(
        { success: false, error: "Field 'teams' must not be empty." },
        { status: 400 }
      );
    }

    const typedTeams = teams as Partial<TeamSeason>[];

    // --- Initialize Supabase admin client ---
    const supabase = createAdminClient();

    // -----------------------------------------------------------------------
    // Step 1: Resolve canonical team names (prevents duplicate records when
    // different sources use different naming conventions)
    // -----------------------------------------------------------------------

    const sourceTeamNames = typedTeams
      .filter((t) => t.team?.name)
      .map((t) => t.team!.name);
    const canonicalNameMap = await resolveCanonicalTeamNames(
      supabase,
      sourceTeamNames
    );

    // -----------------------------------------------------------------------
    // Step 2: Upsert teams (using canonical names)
    // -----------------------------------------------------------------------

    const teamRecords: TeamUpsertRecord[] = typedTeams
      .filter((t) => t.team?.name)
      .map((t) => {
        const sourceName = t.team!.name;
        const teamName = canonicalNameMap.get(sourceName) || sourceName;
        const campus = getCampusLocation(sourceName);
        return {
          name: teamName,
          short_name: generateShortName(teamName),
          conference: t.team?.conference || "Unknown",
          campus_city: campus.city,
          campus_state: campus.state,
          campus_lat: campus.lat,
          campus_lng: campus.lng,
        };
      });

    const { teamIdMap, stats: teamStats } = await upsertTeams(
      supabase,
      teamRecords
    );

    logger.info("Evan Miya commit: teams upserted", {
      count: teamStats.teamsUpserted,
      errors: teamStats.errors,
    });

    // -----------------------------------------------------------------------
    // Step 3: Fetch existing team_seasons for data_sources merge
    // -----------------------------------------------------------------------

    const { data: existingSeasons } = await supabase
      .from("team_seasons")
      .select("team_id, data_sources")
      .eq("season", seasonNum);

    const existingSourcesMap = new Map<string, string[]>();
    if (existingSeasons) {
      for (const row of existingSeasons) {
        existingSourcesMap.set(
          row.team_id,
          (row.data_sources as string[]) || []
        );
      }
    }

    // -----------------------------------------------------------------------
    // Step 4: Build team_season upsert records (Evan Miya columns only)
    // -----------------------------------------------------------------------

    const skippedTeams: string[] = [];
    const teamSeasonRecords = typedTeams
      .map((t) => {
        const teamName = t.team?.name;
        if (!teamName) return null;

        // Use canonical name to look up team ID
        const canonicalName = canonicalNameMap.get(teamName) || teamName;
        const teamId = teamIdMap.get(canonicalName);
        if (!teamId) {
          skippedTeams.push(teamName);
          return null;
        }

        // Destructure Evan Miya-specific fields from normalized data
        const {
          ratings,
          evanmiyaOpponentAdjust,
          evanmiyaPaceAdjust,
          evanmiyaKillShotsPerGame,
          evanmiyaKillShotsAllowedPerGame,
          evanmiyaKillShotsMargin,
        } = t as {
          ratings?: {
            evanmiya?: { adjOE: number; adjDE: number; adjEM: number };
          };
          evanmiyaOpponentAdjust?: number;
          evanmiyaPaceAdjust?: number;
          evanmiyaKillShotsPerGame?: number;
          evanmiyaKillShotsAllowedPerGame?: number;
          evanmiyaKillShotsMargin?: number;
        };

        // Merge data_sources: existing + "evanmiya" (deduplicated)
        const existing = existingSourcesMap.get(teamId) || [];
        const mergedSources = Array.from(new Set([...existing, "evanmiya"]));

        return {
          team_id: teamId,
          season: seasonNum,
          // Evan Miya efficiency ratings
          evanmiya_adj_oe: nanToNull(ratings?.evanmiya?.adjOE),
          evanmiya_adj_de: nanToNull(ratings?.evanmiya?.adjDE),
          evanmiya_adj_em: nanToNull(ratings?.evanmiya?.adjEM),
          // Evan Miya-specific metrics
          evanmiya_opponent_adjust: nanToNull(evanmiyaOpponentAdjust),
          evanmiya_pace_adjust: nanToNull(evanmiyaPaceAdjust),
          evanmiya_kill_shots_per_game: nanToNull(evanmiyaKillShotsPerGame),
          evanmiya_kill_shots_allowed_per_game: nanToNull(
            evanmiyaKillShotsAllowedPerGame
          ),
          evanmiya_kill_shots_margin: nanToNull(evanmiyaKillShotsMargin),
          // Merge data_sources
          data_sources: mergedSources,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (skippedTeams.length > 0) {
      logger.warn("Evan Miya commit: skipped teams without ID mapping", {
        count: skippedTeams.length,
        teams: skippedTeams.slice(0, 10),
      });
    }

    const { count: seasonsUpserted, errors: seasonErrors } =
      await upsertTeamSeasons(supabase, teamSeasonRecords);

    logger.info("Evan Miya commit: team_seasons upserted", {
      count: seasonsUpserted,
      errors: seasonErrors.length,
    });

    // -----------------------------------------------------------------------
    // Step 5: Upsert name mappings
    // -----------------------------------------------------------------------

    const nameMappings = typedTeams
      .filter((t) => {
        if (!t.team?.name) return false;
        const canonical = canonicalNameMap.get(t.team.name) || t.team.name;
        return teamIdMap.get(canonical);
      })
      .map((t) => {
        const sourceName = t.team!.name;
        const canonical = canonicalNameMap.get(sourceName) || sourceName;
        return {
          team_id: teamIdMap.get(canonical)!,
          evanmiya_name: sourceName,
        };
      });

    const { count: mappingsUpserted, errors: mappingErrors } =
      await upsertNameMappings(supabase, nameMappings);

    logger.info("Evan Miya commit: name mappings upserted", {
      count: mappingsUpserted,
      errors: mappingErrors.length,
    });

    // -----------------------------------------------------------------------
    // Step 6: Record import job
    // -----------------------------------------------------------------------

    await recordImportJob(supabase, {
      source: "evanmiya",
      season: seasonNum,
      status: "complete",
      teams_imported: seasonsUpserted,
    });

    // -----------------------------------------------------------------------
    // Step 7: Return response
    // -----------------------------------------------------------------------

    const allErrors = [
      ...(teamStats.errorMessages || []),
      ...seasonErrors,
      ...mappingErrors,
    ];

    return NextResponse.json({
      success: true,
      message: `Evan Miya data committed for season ${seasonNum}. ${seasonsUpserted} team seasons saved.`,
      data: {
        season: seasonNum,
        source: "evanmiya",
        teamsUpserted: teamStats.teamsUpserted ?? 0,
        teamSeasonsUpserted: seasonsUpserted,
        nameMappingsUpserted: mappingsUpserted,
        skippedTeams: skippedTeams.length,
        errors: allErrors,
      },
    });
  } catch (error) {
    logger.error(
      "Evan Miya commit error",
      error instanceof Error ? error : new Error(String(error))
    );
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
