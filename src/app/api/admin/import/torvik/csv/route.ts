/**
 * API Route: POST /api/admin/import/torvik/csv
 *
 * Admin endpoint for validating Torvik Teams Table CSV data. Accepts a CSV
 * string and a season year, then parses, normalizes, and validates the data.
 *
 * This is the CSV upload counterpart to the auto-fetch endpoint at
 * POST /api/admin/import/torvik. The Teams Table CSV provides a richer
 * dataset (including height, experience, talent) but requires manual
 * download from barttorvik.com due to anti-bot protections.
 *
 * Request body:
 * ```json
 * {
 *   "season": 2025,
 *   "csvContent": "TEAM,ADJ OE,ADJ DE,..."
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
import { safeApiError } from "@/lib/api-error";
import { parseCsv } from "@/lib/data/csv-parser";
import { normalizeTorvikCsv, validateBatch } from "@/lib/data";
import type { TorvikCsvRow } from "@/types";

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
    const parsedRows = parseCsv<TorvikCsvRow>(csvContent);

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
      normalizeTorvikCsv(parsedRows, seasonNum);

    // --- Validate ---
    const validationResult = validateBatch(normalizedData);

    // Combine normalization errors with validation errors
    const allErrors = [...normalizationErrors, ...validationResult.errors];

    return NextResponse.json({
      success: true,
      data: {
        season: seasonNum,
        source: "torvik",
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
    const safe = safeApiError(
      "An unexpected error occurred during import.",
      error,
      "admin/import/torvik/csv"
    );
    return NextResponse.json(
      { success: false, error: safe.message },
      { status: safe.status }
    );
  }
}
