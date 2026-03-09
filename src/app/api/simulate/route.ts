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
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import { SIMULATION_COUNT_OPTIONS } from "@/types/simulation";
import type { SimulationConfig, SimulationCount } from "@/types/simulation";
import { createAdminClient } from "@/lib/supabase/client";
import { transformTeamSeasonRows } from "@/lib/supabase/transforms";
import type { TeamSeasonJoinedRow } from "@/lib/supabase/transforms";
import type { TournamentEntryRow } from "@/lib/supabase/types";
import { runSimulation } from "@/lib/engine/simulator";
import type { TeamSeason } from "@/types/team";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
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
      randomSeed,
    } = validation.data;

    // Resolve full engine configuration (merge partial with defaults)
    const resolvedConfig = resolveEngineConfig(engineConfig);
    const resolvedOverrides = matchupOverrides ?? {};
    const resolvedSeed = randomSeed;

    // --- Fetch team data from Supabase ---
    const supabase = createAdminClient();

    // Query team_seasons for the requested season, joining teams and coaches
    const { data: teamSeasonRows, error: teamSeasonsError } = await supabase
      .from("team_seasons")
      .select("*, teams!inner(*), coaches(*)")
      .eq("season", season)
      .order("team_id");

    if (teamSeasonsError) {
      logger.error("Error fetching team seasons", teamSeasonsError);
      return NextResponse.json(
        {
          success: false,
          error: `Database error fetching team data: ${teamSeasonsError.message}`,
        },
        { status: 500 }
      );
    }

    if (!teamSeasonRows || teamSeasonRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No team data found for season ${season}.`,
        },
        { status: 404 }
      );
    }

    // Query tournament entries for the same season
    const { data: tournamentEntries, error: entriesError } = await supabase
      .from("tournament_entries")
      .select("*")
      .eq("season", season);

    if (entriesError) {
      logger.error("Error fetching tournament entries", entriesError);
      return NextResponse.json(
        {
          success: false,
          error: `Database error fetching tournament entries: ${entriesError.message}`,
        },
        { status: 500 }
      );
    }

    if (!tournamentEntries || tournamentEntries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No tournament entries found for season ${season}. The bracket may not have been set yet.`,
        },
        { status: 404 }
      );
    }

    // --- Transform DB rows to application types ---
    const allTeamSeasons = transformTeamSeasonRows(
      teamSeasonRows as unknown as TeamSeasonJoinedRow[],
      tournamentEntries as unknown as TournamentEntryRow[]
    );

    // Filter to only teams that have tournament entries
    const tournamentTeams = allTeamSeasons.filter(
      (ts): ts is TeamSeason & { tournamentEntry: NonNullable<TeamSeason["tournamentEntry"]> } =>
        ts.tournamentEntry !== undefined
    );

    // Validate exactly 64 tournament teams
    if (tournamentTeams.length !== 64) {
      return NextResponse.json(
        {
          success: false,
          error: `Expected 64 tournament teams for season ${season}, but found ${tournamentTeams.length}. ` +
            `The bracket data may be incomplete.`,
        },
        { status: 400 }
      );
    }

    // --- Build teams map and run simulation ---
    const teamsMap = new Map<string, TeamSeason>();
    for (const team of tournamentTeams) {
      teamsMap.set(team.teamId, team);
    }

    const simulationConfig: SimulationConfig = {
      numSimulations,
      engineConfig: resolvedConfig,
      matchupOverrides:
        Object.keys(resolvedOverrides).length > 0
          ? resolvedOverrides
          : undefined,
      randomSeed: resolvedSeed,
    };

    const result = runSimulation(teamsMap, simulationConfig);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    logger.error("Simulation error", error instanceof Error ? error : undefined);
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
