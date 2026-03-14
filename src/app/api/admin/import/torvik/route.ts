/**
 * API Route: POST /api/admin/import/torvik
 *
 * Admin endpoint for importing Torvik data. Unlike KenPom, Torvik data
 * is fetched directly from the barttorvik.com API rather than uploaded
 * as CSV.
 *
 * Request body:
 * ```json
 * {
 *   "season": 2025
 * }
 * ```
 *
 * Response:
 * - 200: Successful fetch, normalization, and validation
 * - 400: Invalid request body
 * - 401: Missing or invalid admin API key
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth/admin-check";
import { safeApiError } from "@/lib/api-error";
import { fetchTorvikData, normalizeTorvik, validateBatch } from "@/lib/data";

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

    const { season } = body as { season?: unknown };

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

    // --- Fetch from Torvik ---
    const fetchResult = await fetchTorvikData(seasonNum);

    if (fetchResult.errors.length > 0 && fetchResult.data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch Torvik data: ${fetchResult.errors.join("; ")}`,
        },
        { status: 400 }
      );
    }

    // --- Normalize ---
    const { data: normalizedData, errors: normalizationErrors } =
      normalizeTorvik(fetchResult.data, seasonNum);

    // --- Validate ---
    const validationResult = validateBatch(normalizedData);

    const allErrors = [...normalizationErrors, ...validationResult.errors];

    return NextResponse.json({
      success: true,
      message: `Torvik data fetched and validated for season ${seasonNum}. ${normalizedData.length} teams processed.`,
      data: {
        season: seasonNum,
        source: "torvik",
        teamCount: normalizedData.length,
        fetchWarnings: fetchResult.errors,
        validation: {
          valid: allErrors.length === 0,
          errors: allErrors,
          validRowCount: validationResult.validRowCount,
          totalRowCount: validationResult.totalRowCount,
          normalizationErrorCount: normalizationErrors.length,
        },
        teams: normalizedData,
      },
    });
  } catch (error) {
    const safe = safeApiError(
      "An unexpected error occurred during import.",
      error,
      "admin/import/torvik"
    );
    return NextResponse.json(
      { success: false, error: safe.message },
      { status: safe.status }
    );
  }
}
