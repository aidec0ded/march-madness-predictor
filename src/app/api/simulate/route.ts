/**
 * API Route: POST /api/simulate
 *
 * Public endpoint for running Monte Carlo bracket simulations. Any authenticated
 * user can trigger a simulation (no admin auth required).
 *
 * Request body:
 * ```json
 * {
 *   "season": 2025,
 *   "numSimulations": 10000,
 *   "engineConfig": { ... },        // Optional, uses DEFAULT_ENGINE_CONFIG
 *   "matchupOverrides": { ... },     // Optional, keyed by gameId
 *   "randomSeed": 42                 // Optional, for reproducibility
 * }
 * ```
 *
 * Response:
 * - 200: Successful simulation with full results
 * - 400: Invalid request body (missing fields, bad values)
 * - 404: No tournament data found for the requested season
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

import type { EngineConfig, MatchupOverrides } from "@/types/engine";
import { resolveEngineConfig } from "@/lib/engine/resolve-config";
import { SIMULATION_COUNT_OPTIONS } from "@/types/simulation";
import type { SimulationConfig, SimulationCount } from "@/types/simulation";
import { runSimulation } from "@/lib/engine/simulator";
import { fetchSimulationData } from "@/lib/supabase/fetch-simulation-data";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { sanitizeEngineConfig, sanitizeMatchupOverrides, sanitizePicks } from "@/lib/validation/engine-config";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

const rateLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60_000 });

// ---------------------------------------------------------------------------
// Request body shape
// ---------------------------------------------------------------------------

/** Shape of the POST request body for /api/simulate */
interface SimulateRequestBody {
  /** Season year (e.g., 2025) */
  season: number;
  /** Number of simulations to run */
  numSimulations: SimulationCount;
  /** Optional engine configuration (global levers + model parameters) */
  engineConfig?: Partial<EngineConfig>;
  /** Optional per-matchup overrides keyed by gameId */
  matchupOverrides?: Record<string, MatchupOverrides>;
  /** Optional user bracket picks keyed by gameId → winning teamId */
  picks?: Record<string, string>;
  /** Optional random seed for reproducible results */
  randomSeed?: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validates and parses the request body for the simulate endpoint.
 *
 * @param body - The raw parsed JSON body
 * @returns An object with either the validated request or an error message
 */
function validateRequestBody(body: unknown):
  | {
      valid: true;
      data: SimulateRequestBody;
    }
  | {
      valid: false;
      error: string;
    } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const { season, numSimulations, engineConfig, matchupOverrides, picks, randomSeed } =
    body as Record<string, unknown>;

  // --- Validate season (required) ---
  if (season === undefined || season === null) {
    return { valid: false, error: "Missing required field: season." };
  }

  const seasonNum =
    typeof season === "string" ? parseInt(season, 10) : Number(season);
  if (!Number.isInteger(seasonNum) || seasonNum < 2000 || seasonNum > 2100) {
    return {
      valid: false,
      error: "Invalid season. Must be an integer between 2000 and 2100.",
    };
  }

  // --- Validate numSimulations (required) ---
  if (numSimulations === undefined || numSimulations === null) {
    return { valid: false, error: "Missing required field: numSimulations." };
  }

  const numSimsValue = Number(numSimulations);
  if (!SIMULATION_COUNT_OPTIONS.includes(numSimsValue as SimulationCount)) {
    return {
      valid: false,
      error: `Invalid numSimulations. Must be one of: ${SIMULATION_COUNT_OPTIONS.join(", ")}.`,
    };
  }

  // --- Validate & sanitize engineConfig (optional) ---
  // Deep sanitization: clamps all numeric values to safe ranges, strips unknown keys
  const sanitizedEngineConfig = engineConfig !== undefined
    ? sanitizeEngineConfig(engineConfig)
    : undefined;
  if (engineConfig !== undefined && typeof engineConfig !== "object") {
    return {
      valid: false,
      error: "Invalid engineConfig. Must be an object if provided.",
    };
  }

  // --- Validate & sanitize matchupOverrides (optional) ---
  // Deep sanitization: clamps adjustments to documented ranges, caps entry count
  const sanitizedMatchupOverrides = matchupOverrides !== undefined
    ? sanitizeMatchupOverrides(matchupOverrides)
    : undefined;
  if (matchupOverrides !== undefined && typeof matchupOverrides !== "object") {
    return {
      valid: false,
      error: "Invalid matchupOverrides. Must be an object if provided.",
    };
  }

  // --- Validate picks (optional) ---
  if (picks !== undefined && typeof picks !== "object") {
    return {
      valid: false,
      error: "Invalid picks. Must be an object (gameId → teamId) if provided.",
    };
  }

  // --- Validate randomSeed (optional) ---
  if (randomSeed !== undefined) {
    const seedValue = Number(randomSeed);
    if (!Number.isFinite(seedValue)) {
      return {
        valid: false,
        error: "Invalid randomSeed. Must be a finite number if provided.",
      };
    }
  }

  return {
    valid: true,
    data: {
      season: seasonNum,
      numSimulations: numSimsValue as SimulationCount,
      engineConfig: sanitizedEngineConfig,
      matchupOverrides: sanitizedMatchupOverrides,
      picks: sanitizePicks(picks),
      randomSeed: randomSeed !== undefined ? Number(randomSeed) : undefined,
    },
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
        { success: false, error: "Too many requests. Please try again later." },
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
        { success: false, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    // --- Validate request ---
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const {
      season,
      numSimulations,
      engineConfig,
      matchupOverrides,
      picks,
      randomSeed,
    } = validation.data;

    // Resolve full engine configuration (merge partial with defaults)
    const resolvedConfig = resolveEngineConfig(engineConfig);
    const resolvedOverrides = matchupOverrides ?? {};
    const resolvedSeed = randomSeed;

    // --- Fetch team data from Supabase ---
    const fetchResult = await fetchSimulationData(season);
    if ("error" in fetchResult) {
      return NextResponse.json(
        { success: false, error: fetchResult.error.message },
        { status: fetchResult.error.status }
      );
    }

    const { teamsMap, playInConfig, siteMap } = fetchResult.data;

    const simulationConfig: SimulationConfig = {
      numSimulations,
      engineConfig: resolvedConfig,
      matchupOverrides:
        Object.keys(resolvedOverrides).length > 0
          ? resolvedOverrides
          : undefined,
      picks: picks && Object.keys(picks).length > 0 ? picks : undefined,
      playInConfig: playInConfig ?? undefined,
      randomSeed: resolvedSeed,
    };

    const result = await runSimulation(teamsMap, simulationConfig, siteMap);

    return NextResponse.json(
      { success: true, result },
      {
        headers: {
          "Server-Timing": `simulation;dur=${result.executionTimeMs}`,
        },
      }
    );
  } catch (error) {
    logger.error("Simulation error", error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred during simulation.",
      },
      { status: 500 }
    );
  }
}
