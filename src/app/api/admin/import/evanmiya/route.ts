/**
 * API Route: POST /api/admin/import/evanmiya
 *
 * Admin endpoint for importing Evan Miya BPR (Bayesian Performance Rating)
 * data. Evan Miya data is entered manually or pasted as structured entries
 * rather than fetched from an API or uploaded as CSV.
 *
 * Request body:
 * ```json
 * {
 *   "season": 2025,
 *   "entries": [
 *     { "team": "Connecticut", "bpr": "31.2", "obpr": "121.5", "dbpr": "90.3" },
 *     { "team": "Houston", "bpr": "28.7", "obpr": "115.1", "dbpr": "86.4" }
 *   ]
 * }
 * ```
 *
 * Response:
 * - 200: Successful normalization and validation
 * - 400: Invalid request body (missing fields, bad entries format, etc.)
 * - 401: Missing or invalid admin API key
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/auth/admin-check";
import { normalizeEvanMiya, validateBatch } from "@/lib/data";
import type { EvanMiyaRawRow } from "@/types";

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

    const { season, entries } = body as { season?: unknown; entries?: unknown };

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

    // --- Validate entries ---
    if (!entries) {
      return NextResponse.json(
        { success: false, error: "Missing required field: entries." },
        { status: 400 }
      );
    }

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        {
          success: false,
          error: "Field 'entries' must be an array of EvanMiyaRawRow objects.",
        },
        { status: 400 }
      );
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: "Field 'entries' must not be empty." },
        { status: 400 }
      );
    }

    // Basic shape validation on entries
    const invalidEntries: number[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof entry.team !== "string" ||
        typeof entry.bpr !== "string" ||
        typeof entry.obpr !== "string" ||
        typeof entry.dbpr !== "string"
      ) {
        invalidEntries.push(i);
      }
    }

    if (invalidEntries.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid entries at indices: [${invalidEntries.join(", ")}]. ` +
            "Each entry must have string fields: team, bpr, obpr, dbpr.",
        },
        { status: 400 }
      );
    }

    // --- Normalize ---
    const typedEntries = entries as EvanMiyaRawRow[];
    const { data: normalizedData, errors: normalizationErrors } =
      normalizeEvanMiya(typedEntries, seasonNum);

    // --- Validate ---
    const validationResult = validateBatch(normalizedData);

    const allErrors = [...normalizationErrors, ...validationResult.errors];

    return NextResponse.json({
      success: true,
      message: `Evan Miya data validated for season ${seasonNum}. ${normalizedData.length} teams processed.`,
      data: {
        season: seasonNum,
        source: "evanmiya",
        teamCount: normalizedData.length,
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
