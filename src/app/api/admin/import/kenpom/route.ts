/**
 * API Route: POST /api/admin/import/kenpom
 *
 * Admin endpoint for importing KenPom CSV data. Accepts a bundle of up to
 * 5 CSV strings (main + optional offense/defense/misc/height) and a season
 * year, then merges, normalizes, and validates the data.
 *
 * Request body:
 * ```json
 * {
 *   "season": 2025,
 *   "csvContent": "Season,TeamName,Tempo,...",
 *   "offenseCsv": "Season,TeamName,eFGPct,...",
 *   "defenseCsv": "Season,TeamName,eFGPct,...",
 *   "miscCsv": "Season,TeamName,FG2Pct,...",
 *   "heightCsv": "Season,TeamName,Size,..."
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
import { mergeKenPomCsvs, normalizeKenPom, validateBatch } from "@/lib/data";
import type { KenPomCsvBundle } from "@/types";

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

    const { season, csvContent, offenseCsv, defenseCsv, miscCsv, heightCsv } =
      body as {
        season?: unknown;
        csvContent?: unknown;
        offenseCsv?: unknown;
        defenseCsv?: unknown;
        miscCsv?: unknown;
        heightCsv?: unknown;
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

    // --- Build CSV bundle and merge ---
    const bundle: KenPomCsvBundle = {
      main: csvContent,
      ...(typeof offenseCsv === "string" && offenseCsv.trim()
        ? { offense: offenseCsv }
        : {}),
      ...(typeof defenseCsv === "string" && defenseCsv.trim()
        ? { defense: defenseCsv }
        : {}),
      ...(typeof miscCsv === "string" && miscCsv.trim()
        ? { misc: miscCsv }
        : {}),
      ...(typeof heightCsv === "string" && heightCsv.trim()
        ? { height: heightCsv }
        : {}),
    };

    const {
      data: mergedRows,
      warnings: mergeWarnings,
      csvSummary,
    } = mergeKenPomCsvs(bundle);

    if (mergedRows.length === 0) {
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
      normalizeKenPom(mergedRows, seasonNum);

    // --- Validate ---
    const validationResult = validateBatch(normalizedData);

    // Combine normalization errors with validation errors
    const allErrors = [...normalizationErrors, ...validationResult.errors];

    return NextResponse.json({
      success: true,
      message: `KenPom data parsed and validated for season ${seasonNum}. ${normalizedData.length} teams processed.`,
      data: {
        season: seasonNum,
        source: "kenpom",
        teamCount: normalizedData.length,
        csvSummary,
        mergeWarnings,
        validation: {
          valid: allErrors.length === 0,
          errors: allErrors,
          validRowCount: validationResult.validRowCount,
          totalRowCount: validationResult.totalRowCount,
          normalizationErrorCount: normalizationErrors.length,
        },
        // Include normalized data for review before DB write
        teams: normalizedData,
      },
    });
  } catch (error) {
    console.error("KenPom import error:", error);
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
