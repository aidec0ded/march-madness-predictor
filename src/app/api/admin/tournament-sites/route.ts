/**
 * API Route: POST/GET/DELETE /api/admin/tournament-sites
 *
 * Admin endpoint for managing tournament venue/site data.
 * Sites are used for site proximity calculations — each site has
 * coordinates and the rounds/regions it hosts.
 *
 * POST: Upsert tournament sites for a season
 * GET: List sites for a season
 * DELETE: Clear all sites for a season
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin-check";
import { createAdminClient } from "@/lib/supabase/client";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { DbTournamentRound, DbTournamentRegion } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const rateLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

const VALID_ROUNDS = new Set(["R64", "R32", "S16", "E8", "F4", "NCG"]);
const VALID_REGIONS = new Set(["East", "West", "South", "Midwest"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SiteInput {
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  rounds: string[];
  regions?: string[];
}

// ---------------------------------------------------------------------------
// POST — Upsert tournament sites
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // Auth check
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limit
    const clientIp = getClientIp(request);
    const rl = rateLimiter.check(clientIp);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests" },
        { status: 429 }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const { season, sites } = body as {
      season?: unknown;
      sites?: unknown;
    };

    // Validate season
    if (
      !season ||
      typeof season !== "number" ||
      !Number.isInteger(season) ||
      season < 2000 ||
      season > 2100
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid season. Must be an integer between 2000 and 2100.",
        },
        { status: 400 }
      );
    }

    // Validate sites array
    if (!Array.isArray(sites) || sites.length === 0) {
      return NextResponse.json(
        { success: false, error: "sites must be a non-empty array." },
        { status: 400 }
      );
    }

    // Validate each site
    const errors: string[] = [];
    const validatedSites: SiteInput[] = [];

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i] as Record<string, unknown>;

      if (!site.name || typeof site.name !== "string") {
        errors.push(`Site ${i}: missing or invalid name`);
        continue;
      }
      if (!site.city || typeof site.city !== "string") {
        errors.push(`Site ${i}: missing or invalid city`);
        continue;
      }
      if (!site.state || typeof site.state !== "string") {
        errors.push(`Site ${i}: missing or invalid state`);
        continue;
      }

      // Validate coordinates
      const lat = Number(site.latitude);
      const lng = Number(site.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push(
          `Site ${i} (${site.name}): invalid latitude ${site.latitude}`
        );
        continue;
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.push(
          `Site ${i} (${site.name}): invalid longitude ${site.longitude}`
        );
        continue;
      }

      // Validate rounds
      if (!Array.isArray(site.rounds) || site.rounds.length === 0) {
        errors.push(`Site ${i} (${site.name}): rounds must be a non-empty array`);
        continue;
      }
      const invalidRounds = (site.rounds as string[]).filter(
        (r) => !VALID_ROUNDS.has(r)
      );
      if (invalidRounds.length > 0) {
        errors.push(
          `Site ${i} (${site.name}): invalid rounds: ${invalidRounds.join(", ")}`
        );
        continue;
      }

      // Validate regions (optional)
      if (site.regions !== undefined && site.regions !== null) {
        if (!Array.isArray(site.regions)) {
          errors.push(`Site ${i} (${site.name}): regions must be an array`);
          continue;
        }
        const invalidRegions = (site.regions as string[]).filter(
          (r) => !VALID_REGIONS.has(r)
        );
        if (invalidRegions.length > 0) {
          errors.push(
            `Site ${i} (${site.name}): invalid regions: ${invalidRegions.join(", ")}`
          );
          continue;
        }
      }

      validatedSites.push({
        name: site.name as string,
        city: site.city as string,
        state: site.state as string,
        latitude: lat,
        longitude: lng,
        rounds: site.rounds as string[],
        regions: (site.regions as string[] | undefined) ?? [],
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation errors:\n${errors.join("\n")}`,
        },
        { status: 400 }
      );
    }

    // Delete existing sites for this season
    const supabase = createAdminClient();
    const { error: deleteError } = await supabase
      .from("tournament_sites")
      .delete()
      .eq("season", season);

    if (deleteError) {
      logger.error("Failed to delete existing tournament sites", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to clear existing sites" },
        { status: 500 }
      );
    }

    // Insert new sites
    const insertData = validatedSites.map((s) => ({
      name: s.name,
      city: s.city,
      state: s.state,
      latitude: s.latitude,
      longitude: s.longitude,
      rounds: s.rounds as DbTournamentRound[],
      regions: (s.regions ?? []).length > 0
        ? (s.regions as DbTournamentRegion[])
        : null,
      season,
    }));

    const { error: insertError } = await supabase
      .from("tournament_sites")
      .insert(insertData);

    if (insertError) {
      logger.error("Failed to insert tournament sites", insertError);
      return NextResponse.json(
        { success: false, error: `Failed to insert sites: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: validatedSites.length,
    });
  } catch (error) {
    logger.error(
      "Tournament sites POST error",
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — List tournament sites for a season
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const season = parseInt(url.searchParams.get("season") ?? "");

    if (!season || isNaN(season)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid season query parameter" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("tournament_sites")
      .select("*")
      .eq("season", season)
      .order("name");

    if (error) {
      logger.error("Failed to fetch tournament sites", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch sites" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sites: data ?? [] });
  } catch (error) {
    logger.error(
      "Tournament sites GET error",
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Clear all sites for a season
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const season = parseInt(url.searchParams.get("season") ?? "");

    if (!season || isNaN(season)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid season query parameter" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("tournament_sites")
      .delete()
      .eq("season", season);

    if (error) {
      logger.error("Failed to delete tournament sites", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete sites" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      "Tournament sites DELETE error",
      error instanceof Error ? error : undefined
    );
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
