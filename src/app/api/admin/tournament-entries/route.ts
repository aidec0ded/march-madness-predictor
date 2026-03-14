/**
 * API Route: /api/admin/tournament-entries
 *
 * Admin endpoint for managing tournament bracket entries.
 * Supports uploading a 68-team bracket (including First Four play-in teams),
 * listing current entries, and clearing entries for a season.
 *
 * POST — Upsert 68 tournament entries from parsed CSV data
 * GET  — List current entries for a season
 * DELETE — Clear all entries for a season
 *
 * The NCAA tournament has 68 teams: 64 in the main bracket plus 4 "First Four"
 * play-in games (2 between 16-seeds, 2 between 11-seeds). Seeds 11 and 16
 * each have 6 entries total; all other seeds have exactly 4.
 */

import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth/admin-check";
import { safeApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/client";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { SEED_TO_BRACKET_POSITION } from "@/lib/engine/bracket";
import type { DbTournamentRegion } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Rate limiter — 10 requests per 60 seconds
// ---------------------------------------------------------------------------

const rateLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_REGIONS: DbTournamentRegion[] = ["East", "West", "South", "Midwest"];

/** Total teams in the NCAA tournament (including First Four play-in teams). */
const TOTAL_TEAMS = 68;

/** Seeds that have play-in games (6 entries instead of 4). */
const PLAY_IN_SEEDS = new Set([11, 16]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntryInput {
  team: string;
  seed: number;
  region: string;
}

// ---------------------------------------------------------------------------
// POST — Upsert tournament entries
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // --- Auth check ---
  if (!(await isAdmin(request))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Provide a valid x-admin-key header." },
      { status: 401 }
    );
  }

  // --- Rate limit ---
  const clientIp = getClientIp(request);
  const rl = rateLimiter.check(clientIp);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
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

    const { season, entries } = body as {
      season?: unknown;
      entries?: unknown;
    };

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

    // --- Validate entries array ---
    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { success: false, error: "Missing required field: entries (array)." },
        { status: 400 }
      );
    }

    if (entries.length !== TOTAL_TEAMS) {
      return NextResponse.json(
        {
          success: false,
          error: `Expected exactly ${TOTAL_TEAMS} entries, received ${entries.length}.`,
        },
        { status: 400 }
      );
    }

    // --- Validate individual entries ---
    const validationErrors: string[] = [];
    const seedCounts: Record<number, number> = {};
    const regionSeedMap: Record<string, number[]> = {};

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i] as EntryInput;

      if (!entry.team || typeof entry.team !== "string") {
        validationErrors.push(`Entry ${i + 1}: missing or invalid team name.`);
        continue;
      }

      const seed = Number(entry.seed);
      if (!Number.isInteger(seed) || seed < 1 || seed > 16) {
        validationErrors.push(
          `Entry ${i + 1} ("${entry.team}"): invalid seed ${entry.seed}. Must be 1–16.`
        );
        continue;
      }

      if (!VALID_REGIONS.includes(entry.region as DbTournamentRegion)) {
        validationErrors.push(
          `Entry ${i + 1} ("${entry.team}"): invalid region "${entry.region}". Must be one of: ${VALID_REGIONS.join(", ")}.`
        );
        continue;
      }

      seedCounts[seed] = (seedCounts[seed] ?? 0) + 1;

      const regionKey = entry.region;
      if (!regionSeedMap[regionKey]) {
        regionSeedMap[regionKey] = [];
      }
      regionSeedMap[regionKey].push(seed);
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed for ${validationErrors.length} entries.`,
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // --- Validate bracket structure ---
    const structureErrors: string[] = [];

    for (let seed = 1; seed <= 16; seed++) {
      const expected = PLAY_IN_SEEDS.has(seed) ? 6 : 4;
      const actual = seedCounts[seed] ?? 0;
      if (actual !== expected) {
        structureErrors.push(
          `Seed ${seed}: expected ${expected} entries, found ${actual}.`
        );
      }
    }

    // Validate each region has at least seeds 1-16
    for (const region of VALID_REGIONS) {
      const seeds = regionSeedMap[region] ?? [];
      for (let seed = 1; seed <= 16; seed++) {
        if (!seeds.includes(seed)) {
          structureErrors.push(
            `Region "${region}" is missing seed ${seed}.`
          );
        }
      }
    }

    if (structureErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Bracket structure validation failed.",
          details: structureErrors,
        },
        { status: 400 }
      );
    }

    // --- Resolve team names to IDs ---
    const supabase = createAdminClient();

    // Fetch all teams and name mappings in parallel
    const [teamsResult, mappingsResult] = await Promise.all([
      supabase.from("teams").select("id, name, short_name"),
      supabase.from("team_name_mappings").select("team_id, kenpom_name, torvik_name, evanmiya_name"),
    ]);

    if (teamsResult.error) {
      logger.error("Failed to fetch teams for name resolution", new Error(teamsResult.error.message));
      return NextResponse.json(
        { success: false, error: "Failed to fetch teams from database." },
        { status: 500 }
      );
    }

    // Build lookup maps (case-insensitive)
    const teamsByName = new Map<string, { id: string; name: string }>();
    for (const team of teamsResult.data ?? []) {
      teamsByName.set(team.name.toLowerCase(), { id: team.id, name: team.name });
      if (team.short_name) {
        teamsByName.set(team.short_name.toLowerCase(), { id: team.id, name: team.name });
      }
    }

    // Add name mappings to lookup
    if (mappingsResult.data) {
      for (const mapping of mappingsResult.data) {
        const team = [...teamsByName.values()].find((t) => t.id === mapping.team_id);
        if (team) {
          if (mapping.kenpom_name) teamsByName.set(mapping.kenpom_name.toLowerCase(), team);
          if (mapping.torvik_name) teamsByName.set(mapping.torvik_name.toLowerCase(), team);
          if (mapping.evanmiya_name) teamsByName.set(mapping.evanmiya_name.toLowerCase(), team);
        }
      }
    }

    // Resolve each entry's team name
    const unresolvedTeams: string[] = [];
    const resolvedEntries: {
      teamId: string;
      canonicalName: string;
      inputName: string;
      seed: number;
      region: DbTournamentRegion;
      bracketPosition: number;
    }[] = [];

    for (const entry of entries as EntryInput[]) {
      const trimmedName = entry.team.trim();
      const match = teamsByName.get(trimmedName.toLowerCase());

      if (!match) {
        unresolvedTeams.push(trimmedName);
        continue;
      }

      resolvedEntries.push({
        teamId: match.id,
        canonicalName: match.name,
        inputName: trimmedName,
        seed: Number(entry.seed),
        region: entry.region as DbTournamentRegion,
        bracketPosition: SEED_TO_BRACKET_POSITION[Number(entry.seed)],
      });
    }

    if (unresolvedTeams.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Could not resolve ${unresolvedTeams.length} team name(s) to database records.`,
          unresolvedTeams,
        },
        { status: 400 }
      );
    }

    // --- Resolve team_season_ids ---
    const { data: teamSeasons, error: teamSeasonsError } = await supabase
      .from("team_seasons")
      .select("id, team_id")
      .eq("season", seasonNum);

    if (teamSeasonsError) {
      logger.error("Failed to fetch team_seasons", new Error(teamSeasonsError.message));
      return NextResponse.json(
        { success: false, error: "Failed to fetch team seasons from database." },
        { status: 500 }
      );
    }

    const teamSeasonIdMap = new Map<string, string>();
    for (const ts of teamSeasons ?? []) {
      teamSeasonIdMap.set(ts.team_id, ts.id);
    }

    const missingTeamSeasons: string[] = [];
    for (const entry of resolvedEntries) {
      const tsId = teamSeasonIdMap.get(entry.teamId);
      if (!tsId) {
        missingTeamSeasons.push(
          `${entry.canonicalName} (team_id=${entry.teamId})`
        );
      }
    }

    if (missingTeamSeasons.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${missingTeamSeasons.length} team(s) have no team_seasons record for season ${seasonNum}. Import team data first.`,
          missingTeamSeasons,
        },
        { status: 400 }
      );
    }

    // --- Delete existing entries and insert new ones ---
    const { error: deleteError } = await supabase
      .from("tournament_entries")
      .delete()
      .eq("season", seasonNum);

    if (deleteError) {
      logger.error("Failed to delete existing tournament entries", new Error(deleteError.message));
      return NextResponse.json(
        { success: false, error: "Failed to clear existing entries." },
        { status: 500 }
      );
    }

    // Build insert records
    const insertRecords = resolvedEntries.map((entry) => ({
      team_season_id: teamSeasonIdMap.get(entry.teamId)!,
      team_id: entry.teamId,
      season: seasonNum,
      seed: entry.seed,
      region: entry.region,
      bracket_position: entry.bracketPosition,
    }));

    const { error: insertError } = await supabase
      .from("tournament_entries")
      .insert(insertRecords);

    if (insertError) {
      logger.error("Failed to insert tournament entries", new Error(insertError.message));
      return NextResponse.json(
        { success: false, error: `Failed to insert entries: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Identify name mappings used (input name differs from canonical name)
    const nameMappingsUsed = resolvedEntries
      .filter((e) => e.inputName.toLowerCase() !== e.canonicalName.toLowerCase())
      .map((e) => `"${e.inputName}" → "${e.canonicalName}"`);

    return NextResponse.json({
      success: true,
      message: `Successfully populated ${TOTAL_TEAMS} tournament entries for season ${seasonNum}.`,
      data: {
        season: seasonNum,
        entriesInserted: insertRecords.length,
        nameMappingsUsed,
      },
    });
  } catch (error) {
    const safe = safeApiError(
      "An unexpected error occurred during import.",
      error,
      "admin/tournament-entries/POST"
    );
    return NextResponse.json(
      { success: false, error: safe.message },
      { status: safe.status }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — List current tournament entries for a season
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // --- Auth check ---
  if (!(await isAdmin(request))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Provide a valid x-admin-key header." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");

    if (!seasonParam) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: season." },
        { status: 400 }
      );
    }

    const seasonNum = parseInt(seasonParam, 10);
    if (!Number.isInteger(seasonNum) || seasonNum < 2000 || seasonNum > 2100) {
      return NextResponse.json(
        { success: false, error: "Invalid season parameter." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: entries, error } = await supabase
      .from("tournament_entries")
      .select("*, teams!inner(name, short_name)")
      .eq("season", seasonNum)
      .order("region")
      .order("seed");

    if (error) {
      logger.error("Failed to fetch tournament entries", new Error(error.message));
      return NextResponse.json(
        { success: false, error: "Failed to fetch entries." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        season: seasonNum,
        count: entries?.length ?? 0,
        entries: entries ?? [],
      },
    });
  } catch (error) {
    const safe = safeApiError(
      "An unexpected error occurred.",
      error,
      "admin/tournament-entries/GET"
    );
    return NextResponse.json(
      { success: false, error: safe.message },
      { status: safe.status }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Clear all entries for a season
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  // --- Auth check ---
  if (!(await isAdmin(request))) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Provide a valid x-admin-key header." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const seasonParam = searchParams.get("season");

    if (!seasonParam) {
      return NextResponse.json(
        { success: false, error: "Missing required query parameter: season." },
        { status: 400 }
      );
    }

    const seasonNum = parseInt(seasonParam, 10);
    if (!Number.isInteger(seasonNum) || seasonNum < 2000 || seasonNum > 2100) {
      return NextResponse.json(
        { success: false, error: "Invalid season parameter." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error, count } = await supabase
      .from("tournament_entries")
      .delete({ count: "exact" })
      .eq("season", seasonNum);

    if (error) {
      logger.error("Failed to delete tournament entries", new Error(error.message));
      return NextResponse.json(
        { success: false, error: "Failed to delete entries." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${count ?? 0} tournament entries for season ${seasonNum}.`,
      data: {
        season: seasonNum,
        deletedCount: count ?? 0,
      },
    });
  } catch (error) {
    const safe = safeApiError(
      "An unexpected error occurred.",
      error,
      "admin/tournament-entries/DELETE"
    );
    return NextResponse.json(
      { success: false, error: safe.message },
      { status: safe.status }
    );
  }
}
