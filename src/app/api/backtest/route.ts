/**
 * API Route: POST /api/backtest
 *
 * Public endpoint for running backtests against historical tournament data.
 * Evaluates model calibration by replaying past tournaments (2008–2024) and
 * scoring predictions with Brier Score, compared against a seed-based baseline.
 *
 * Request body:
 * ```json
 * {
 *   "seasons": [2021, 2022, 2023, 2024],
 *   "engineConfig": { ... }  // Optional, uses DEFAULT_ENGINE_CONFIG
 * }
 * ```
 *
 * Response:
 * - 200: Successful backtest with full results
 * - 400: Invalid request body (missing fields, bad values)
 * - 404: No historical results exist for the requested seasons
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

import type { EngineConfig } from "@/types/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { BacktestRequest, BacktestResponse } from "@/types/backtest";
import { createPublicClient } from "@/lib/supabase/client";
import { transformTeamSeasonRows } from "@/lib/supabase/transforms";
import type { TeamSeasonJoinedRow } from "@/lib/supabase/transforms";
import { HISTORICAL_RESULTS } from "@/lib/backtest/historical-results";
import { runBacktestMultiYear } from "@/lib/backtest/runner";
import type { TeamSeason } from "@/types/team";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

const rateLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates and parses the request body for the backtest endpoint.
 *
 * Checks that:
 * - `seasons` is a non-empty array of integers between 2000 and 2100
 * - `engineConfig` is an object if provided
 *
 * @param body - The raw parsed JSON body
 * @returns An object with either the validated request or an error message
 */
function validateRequestBody(body: unknown):
  | {
      valid: true;
      data: BacktestRequest;
    }
  | {
      valid: false;
      error: string;
    } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const { seasons, engineConfig } = body as Record<string, unknown>;

  // --- Validate seasons (required) ---
  if (seasons === undefined || seasons === null) {
    return { valid: false, error: "Missing required field: seasons." };
  }

  if (!Array.isArray(seasons)) {
    return { valid: false, error: "Invalid seasons. Must be an array." };
  }

  if (seasons.length === 0) {
    return {
      valid: false,
      error: "Invalid seasons. Must be a non-empty array.",
    };
  }

  for (const season of seasons) {
    const seasonNum =
      typeof season === "string" ? parseInt(season, 10) : Number(season);
    if (
      !Number.isInteger(seasonNum) ||
      seasonNum < 2000 ||
      seasonNum > 2100
    ) {
      return {
        valid: false,
        error: `Invalid season value: ${season}. Each season must be an integer between 2000 and 2100.`,
      };
    }
  }

  // --- Validate engineConfig (optional) ---
  if (engineConfig !== undefined && typeof engineConfig !== "object") {
    return {
      valid: false,
      error: "Invalid engineConfig. Must be an object if provided.",
    };
  }

  return {
    valid: true,
    data: {
      seasons: seasons.map((s: unknown) => Number(s)),
      engineConfig: engineConfig as Partial<EngineConfig> | undefined,
    },
  };
}

/**
 * Merges a partial engine config with the defaults to produce a complete
 * EngineConfig. Fields not specified in the partial will use defaults.
 *
 * @param partial - Optional partial engine configuration from the request
 * @returns A complete EngineConfig
 */
function resolveEngineConfig(partial?: Partial<EngineConfig>): EngineConfig {
  if (!partial) {
    return { ...DEFAULT_ENGINE_CONFIG };
  }

  return {
    levers: partial.levers
      ? { ...DEFAULT_ENGINE_CONFIG.levers, ...partial.levers }
      : { ...DEFAULT_ENGINE_CONFIG.levers },
    logisticK: partial.logisticK ?? DEFAULT_ENGINE_CONFIG.logisticK,
    baseVariance: partial.baseVariance ?? DEFAULT_ENGINE_CONFIG.baseVariance,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // --- Rate limit ---
    const clientIp = getClientIp(request);
    const rl = rateLimiter.check(clientIp);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." } satisfies BacktestResponse,
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(rl.remaining),
            "X-RateLimit-Reset": String(rl.resetAt),
          },
        }
      );
    }

    // --- Parse request body ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body." } satisfies BacktestResponse,
        { status: 400 }
      );
    }

    // --- Validate request ---
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error } satisfies BacktestResponse,
        { status: 400 }
      );
    }

    const { seasons, engineConfig } = validation.data;

    // Resolve full engine configuration (merge partial with defaults)
    const resolvedConfig = resolveEngineConfig(engineConfig);

    // --- Filter historical results to only requested seasons ---
    const filteredResults = HISTORICAL_RESULTS.filter((r) =>
      seasons.includes(r.season)
    );

    if (filteredResults.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No historical tournament results found for the requested seasons: ${seasons.join(", ")}. ` +
            `Available seasons are those with archived data (2008–2024, excluding 2020).`,
        } satisfies BacktestResponse,
        { status: 404 }
      );
    }

    // --- Fetch team data from Supabase for each season ---
    const supabase = createPublicClient();
    const teamsBySeason = new Map<number, TeamSeason[]>();

    for (const season of seasons) {
      // Query team_seasons for this season, joining teams and coaches
      const { data: teamSeasonRows, error: teamSeasonsError } = await supabase
        .from("team_seasons")
        .select("*, teams!inner(*), coaches(*)")
        .eq("season", season)
        .returns<TeamSeasonJoinedRow[]>();

      if (teamSeasonsError) {
        logger.error(
          `Error fetching team seasons for ${season}`,
          teamSeasonsError
        );
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch team data for season ${season}. Please try again.`,
          } satisfies BacktestResponse,
          { status: 500 }
        );
      }

      if (teamSeasonRows && teamSeasonRows.length > 0) {
        // Transform rows — no tournament entries needed for backtest
        const teamSeasons = transformTeamSeasonRows(
          teamSeasonRows
        );
        teamsBySeason.set(season, teamSeasons);
      } else {
        // Season has no team data — store empty array; runner will
        // fall back to seed baseline for games in this season
        teamsBySeason.set(season, []);
      }
    }

    // --- Run multi-year backtest ---
    const result = runBacktestMultiYear(
      filteredResults,
      teamsBySeason,
      resolvedConfig
    );

    return NextResponse.json({
      success: true,
      result,
    } satisfies BacktestResponse);
  } catch (error) {
    logger.error("Backtest error", error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred during backtesting.",
      } satisfies BacktestResponse,
      { status: 500 }
    );
  }
}
