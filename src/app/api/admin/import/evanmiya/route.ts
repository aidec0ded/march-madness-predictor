/**
 * API Route: POST /api/admin/import/evanmiya
 *
 * Admin endpoint for validating Evan Miya CSV data. Accepts a CSV string
 * and a season year, then parses, normalizes, and validates the data.
 *
 * Request body:
 * ```json
 * {
 *   "season": 2025,
 *   "csvContent": "team,obpr,dbpr,bpr,opponent_adjust,pace_adjust,..."
 * }
 * ```
 *
 * Response:
 * - 200: Successful parse and validation (includes normalized data and validation result)
 * - 400: Invalid request body (missing fields, bad season, etc.)
 * - 401: Missing or invalid admin API key
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth/admin-check";
import { parseCsv } from "@/lib/data/csv-parser";
import { normalizeEvanMiya, validateBatch } from "@/lib/data";
import type { EvanMiyaCsvRow } from "@/types";

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

    const { season, csvContent } = body as {
      season?: unknown;
      csvContent?: unknown;
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

    // --- Validate CSV content ---
    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required field: csvContent (must be a non-empty string).",
        },
        { status: 400 }
      );
    }

    if (csvContent.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "csvContent is empty." },
        { status: 400 }
      );
    }

    // --- Parse CSV ---
    const parsedRows = parseCsv<EvanMiyaCsvRow>(csvContent);

    if (parsedRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CSV parsed successfully but contained no data rows. Check the format.",
        },
        { status: 400 }
      );
    }

    // --- Normalize ---
    const { data: normalizedData, errors: normalizationErrors } =
      normalizeEvanMiya(parsedRows, seasonNum);

    // --- Validate ---
    const validationResult = validateBatch(normalizedData);

    // Combine normalization errors with validation errors
    const allErrors = [...normalizationErrors, ...validationResult.errors];

    return NextResponse.json({
      success: true,
      data: {
        season: seasonNum,
        source: "evanmiya",
        teamCount: normalizedData.length,
        validation: {
          valid: allErrors.length === 0,
          errors: allErrors,
          validRowCount: validationResult.validRowCount,
          totalRowCount: validationResult.totalRowCount,
        },
        teams: normalizedData,
      },
    });
  } catch (error) {
    console.error("Evan Miya import error:", error);
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
