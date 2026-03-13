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
import { createPublicClient } from "@/lib/supabase/client";
import { transformTeamSeasonRows } from "@/lib/supabase/transforms";
import type { TeamSeasonJoinedRow } from "@/lib/supabase/transforms";
import type { TournamentEntryRow } from "@/lib/supabase/types";
import { runSimulation } from "@/lib/engine/simulator";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import { buildSiteMap } from "@/lib/engine/site-mapping";
import { processTournamentField } from "@/lib/bracket-utils";
import type { TeamSeason, TournamentSite, TournamentRound, Region } from "@/types/team";
import type { TournamentSiteRow } from "@/lib/supabase/types";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { sanitizeEngineConfig, sanitizeMatchupOverrides } from "@/lib/validation/engine-config";
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
      picks: picks as Record<string, string> | undefined,
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
      picks,
      randomSeed,
    } = validation.data;

    // Resolve full engine configuration (merge partial with defaults)
    const resolvedConfig = resolveEngineConfig(engineConfig);
    const resolvedOverrides = matchupOverrides ?? {};
    const resolvedSeed = randomSeed;

    // --- Fetch team data from Supabase ---
    const supabase = createPublicClient();

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
          error: "Failed to fetch team data. Please try again.",
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
          error: "Failed to fetch tournament entries. Please try again.",
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

    // --- Fetch tournament sites (optional — graceful degradation) ---
    const { data: sitesRows } = await supabase
      .from("tournament_sites")
      .select("*")
      .eq("season", season);

    // --- Transform DB rows to application types ---
    const allTeamSeasons = transformTeamSeasonRows(
      teamSeasonRows as unknown as TeamSeasonJoinedRow[],
      tournamentEntries as unknown as TournamentEntryRow[]
    );

    // Filter to only teams that have tournament entries and detect play-in pairs
    const allTournamentTeams = allTeamSeasons.filter(
      (ts): ts is TeamSeason & { tournamentEntry: NonNullable<TeamSeason["tournamentEntry"]> } =>
        ts.tournamentEntry !== undefined
    );

    const { teams: tournamentTeams, playInConfig } = processTournamentField(allTournamentTeams);

    // Validate team count: 64 (no play-ins) or 68 (with play-ins)
    const expectedCount = playInConfig ? 68 : 64;
    if (tournamentTeams.length !== expectedCount) {
      return NextResponse.json(
        {
          success: false,
          error: `Expected ${expectedCount} tournament teams for season ${season}, but found ${tournamentTeams.length}. ` +
            `The bracket data may be incomplete.`,
        },
        { status: 400 }
      );
    }

    // Transform site rows to TournamentSite[] and build site map
    let siteMap;
    if (sitesRows && sitesRows.length > 0) {
      const sites: TournamentSite[] = (sitesRows as TournamentSiteRow[]).map(
        (row) => ({
          id: row.id,
          name: row.name,
          city: row.city,
          state: row.state,
          latitude: row.latitude,
          longitude: row.longitude,
          rounds: row.rounds as TournamentRound[],
          regions: row.regions
            ? (row.regions as Region[])
            : undefined,
          season: row.season,
        })
      );
      const matchups = buildBracketMatchups(playInConfig);
      siteMap = buildSiteMap(matchups, sites);
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
      picks: picks && Object.keys(picks).length > 0 ? picks : undefined,
      playInConfig: playInConfig ?? undefined,
      randomSeed: resolvedSeed,
    };

    const result = runSimulation(teamsMap, simulationConfig, siteMap);

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
