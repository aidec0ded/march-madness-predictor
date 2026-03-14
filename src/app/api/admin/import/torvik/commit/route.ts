/**
 * API Route: POST /api/admin/import/torvik/commit
 *
 * "Confirm & Save to Database" endpoint for the Torvik import pipeline.
 * Receives validated + normalized team data from the preview step
 * (POST /api/admin/import/torvik) and upserts it into Supabase.
 *
 * Torvik provides efficiency ratings, Four Factors, shooting splits, and
 * tempo. The commit writes only Torvik-specific efficiency columns and
 * shared Four Factors / shooting / tempo columns. It does NOT touch
 * KenPom-exclusive columns (bench minutes, experience, continuity,
 * height, 2-foul participation) or Evan Miya-specific columns.
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
import { safeApiError } from "@/lib/api-error";
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

    logger.info("Torvik commit: teams upserted", {
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
    // Step 4: Build team_season upsert records (Torvik columns only)
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

        // Destructure Torvik fields from normalized data
        const {
          ratings,
          fourFactorsOffense,
          fourFactorsDefense,
          shootingOffense,
          shootingDefense,
          adjTempo,
          avgHeight,
          experience,
        } = t as {
          ratings?: {
            torvik?: { adjOE: number; adjDE: number; adjEM: number };
          };
          fourFactorsOffense?: {
            efgPct: number;
            toPct: number;
            orbPct: number;
            ftRate: number;
          };
          fourFactorsDefense?: {
            efgPct: number;
            toPct: number;
            orbPct: number;
            ftRate: number;
          };
          shootingOffense?: {
            threePtPct: number;
            threePtRate: number;
            ftPct: number;
          };
          shootingDefense?: {
            threePtPct: number;
            threePtRate: number;
            ftPct: number;
          };
          adjTempo?: number;
          avgHeight?: number;
          experience?: number;
        };

        // Merge data_sources: existing + "torvik" (deduplicated)
        const existing = existingSourcesMap.get(teamId) || [];
        const mergedSources = Array.from(new Set([...existing, "torvik"]));

        // Build the base record with core Torvik columns
        const record: { team_id: string; season: number; [key: string]: unknown } = {
          team_id: teamId,
          season: seasonNum,
          // Torvik efficiency ratings
          torvik_adj_oe: nanToNull(ratings?.torvik?.adjOE),
          torvik_adj_de: nanToNull(ratings?.torvik?.adjDE),
          torvik_adj_em: nanToNull(ratings?.torvik?.adjEM),
          // Four Factors (offense) — shared columns
          off_efg_pct: nanToNull(fourFactorsOffense?.efgPct),
          off_to_pct: nanToNull(fourFactorsOffense?.toPct),
          off_orb_pct: nanToNull(fourFactorsOffense?.orbPct),
          off_ft_rate: nanToNull(fourFactorsOffense?.ftRate),
          // Shooting (offense)
          off_three_pt_pct: nanToNull(shootingOffense?.threePtPct),
          off_three_pt_rate: nanToNull(shootingOffense?.threePtRate),
          off_ft_pct: nanToNull(shootingOffense?.ftPct),
          // Tempo
          adj_tempo: nanToNull(adjTempo),
          // Merge data_sources
          data_sources: mergedSources,
        };

        // Four Factors (defense) — from fffinal CSV. Include only when
        // available so a failed fffinal fetch doesn't null out KenPom-
        // provided values for these shared columns.
        if (fourFactorsDefense) {
          const defEfg = nanToNull(fourFactorsDefense.efgPct);
          const defTo = nanToNull(fourFactorsDefense.toPct);
          const defOrb = nanToNull(fourFactorsDefense.orbPct);
          const defFt = nanToNull(fourFactorsDefense.ftRate);
          if (defEfg !== null) record.def_efg_pct = defEfg;
          if (defTo !== null) record.def_to_pct = defTo;
          if (defOrb !== null) record.def_orb_pct = defOrb;
          if (defFt !== null) record.def_ft_rate = defFt;
        }

        // Shooting (defense) — from fffinal CSV. Same conditional pattern.
        if (shootingDefense) {
          const defThreePt = nanToNull(shootingDefense.threePtPct);
          const defThreeRate = nanToNull(shootingDefense.threePtRate);
          const defFtPct = nanToNull(shootingDefense.ftPct);
          if (defThreePt !== null) record.def_three_pt_pct = defThreePt;
          if (defThreeRate !== null) record.def_three_pt_rate = defThreeRate;
          if (defFtPct !== null) record.def_ft_pct = defFtPct;
        }

        // Height & experience — only present from Teams Table CSV upload.
        // Include only when available so the API-fetch path doesn't null
        // out KenPom-provided values for these shared columns.
        const heightVal = nanToNull(avgHeight);
        if (heightVal !== null) record.avg_height = heightVal;
        const expVal = nanToNull(experience);
        if (expVal !== null) record.experience = expVal;

        return record;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (skippedTeams.length > 0) {
      logger.warn("Torvik commit: skipped teams without ID mapping", {
        count: skippedTeams.length,
        teams: skippedTeams.slice(0, 10),
      });
    }

    const { count: seasonsUpserted, errors: seasonErrors } =
      await upsertTeamSeasons(supabase, teamSeasonRecords);

    logger.info("Torvik commit: team_seasons upserted", {
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
          torvik_name: sourceName,
        };
      });

    const { count: mappingsUpserted, errors: mappingErrors } =
      await upsertNameMappings(supabase, nameMappings);

    logger.info("Torvik commit: name mappings upserted", {
      count: mappingsUpserted,
      errors: mappingErrors.length,
    });

    // -----------------------------------------------------------------------
    // Step 6: Record import job
    // -----------------------------------------------------------------------

    await recordImportJob(supabase, {
      source: "torvik",
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
      message: `Torvik data committed for season ${seasonNum}. ${seasonsUpserted} team seasons saved.`,
      data: {
        season: seasonNum,
        source: "torvik",
        teamsUpserted: teamStats.teamsUpserted ?? 0,
        teamSeasonsUpserted: seasonsUpserted,
        nameMappingsUpserted: mappingsUpserted,
        skippedTeams: skippedTeams.length,
        errors: allErrors,
      },
    });
  } catch (error) {
    const safe = safeApiError(
      "An unexpected error occurred during import.",
      error,
      "admin/import/torvik/commit"
    );
    return NextResponse.json(
      { success: false, error: safe.message },
      { status: safe.status }
    );
  }
}
