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
 * - 501: Database not yet connected (temporary — pre-Supabase)
 * - 500: Unexpected server error
 */

import { NextResponse } from "next/server";

import type { EngineConfig, MatchupOverrides } from "@/types/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import { SIMULATION_COUNT_OPTIONS } from "@/types/simulation";
import type { SimulationCount } from "@/types/simulation";

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

  const { season, numSimulations, engineConfig, matchupOverrides, randomSeed } =
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

  // --- Validate engineConfig (optional) ---
  if (engineConfig !== undefined && typeof engineConfig !== "object") {
    return {
      valid: false,
      error: "Invalid engineConfig. Must be an object if provided.",
    };
  }

  // --- Validate matchupOverrides (optional) ---
  if (matchupOverrides !== undefined && typeof matchupOverrides !== "object") {
    return {
      valid: false,
      error: "Invalid matchupOverrides. Must be an object if provided.",
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
      engineConfig: engineConfig as Partial<EngineConfig> | undefined,
      matchupOverrides: matchupOverrides as
        | Record<string, MatchupOverrides>
        | undefined,
      randomSeed: randomSeed !== undefined ? Number(randomSeed) : undefined,
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
      randomSeed,
    } = validation.data;

    // Resolve full engine configuration (merge partial with defaults)
    const _resolvedConfig = resolveEngineConfig(engineConfig);
    const _resolvedOverrides = matchupOverrides ?? {};
    const _resolvedSeed = randomSeed;

    // TODO (Phase 4): Fetch 64 TeamSeason records from Supabase for the
    // requested season. The query will be:
    //
    //   const { data: teams, error } = await supabase
    //     .from("team_seasons")
    //     .select("*, teams(*), coaches(*)")
    //     .eq("season", season)
    //     .not("tournament_entry", "is", null)
    //     .order("team_id");
    //
    // Once fetched:
    // 1. Validate that exactly 64 teams have tournament entries
    // 2. Build bracket slots using buildBracketSlots(teams)
    // 3. Build bracket matchups using buildBracketMatchups()
    // 4. Create SimulationConfig from resolved parameters
    // 5. Run simulation using runSimulation(teams, config)
    // 6. Return SimulationResult

    return NextResponse.json(
      {
        success: false,
        error:
          "Simulation endpoint is active but not yet connected to the database. " +
          "Team data retrieval from Supabase will be implemented in Phase 4. " +
          `Received valid request for season ${season} with ${numSimulations} simulations.`,
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during simulation.",
      },
      { status: 500 }
    );
  }
}
