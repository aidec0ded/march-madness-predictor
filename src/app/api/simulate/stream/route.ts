/**
 * API Route: POST /api/simulate/stream
 *
 * Streaming variant of the simulation endpoint that sends Server-Sent Events
 * (SSE) for real-time progress reporting during long-running simulations.
 *
 * Events:
 * - `progress`: Fired every ~1000 simulations with { completed, total, elapsedMs }
 * - `result`:   Final event with { success: true, result: SimulationResult }
 * - `error`:    Fired on failure with { success: false, error: string }
 *
 * Request body is identical to POST /api/simulate.
 */

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
import type { SiteMap } from "@/lib/engine/site-mapping";
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
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  /** Helper to format an SSE event. */
  function sseEvent(event: string, data: unknown): Uint8Array {
    return encoder.encode(
      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    );
  }

  try {
    // --- Rate limit ---
    const clientIp = getClientIp(request);
    const rl = rateLimiter.check(clientIp);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": String(rl.remaining),
            "X-RateLimit-Reset": String(rl.resetAt),
          },
        }
      );
    }

    // --- Parse request body ---
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- Validate request ---
    const { season, numSimulations, engineConfig, matchupOverrides, picks, randomSeed } = body;

    const seasonNum =
      typeof season === "string" ? parseInt(season as string, 10) : Number(season);
    if (!Number.isInteger(seasonNum) || seasonNum < 2000 || seasonNum > 2100) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid season." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const numSimsValue = Number(numSimulations);
    if (!SIMULATION_COUNT_OPTIONS.includes(numSimsValue as SimulationCount)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid numSimulations. Must be one of: ${SIMULATION_COUNT_OPTIONS.join(", ")}.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sanitize & resolve config — clamps all values to safe ranges
    const sanitizedConfig = sanitizeEngineConfig(engineConfig);
    const resolvedConfig: EngineConfig = sanitizedConfig
      ? {
          levers: {
            ...DEFAULT_ENGINE_CONFIG.levers,
            ...sanitizedConfig.levers,
          },
          logisticK:
            sanitizedConfig.logisticK ??
            DEFAULT_ENGINE_CONFIG.logisticK,
          baseVariance:
            sanitizedConfig.baseVariance ??
            DEFAULT_ENGINE_CONFIG.baseVariance,
        }
      : { ...DEFAULT_ENGINE_CONFIG };

    const resolvedOverrides = sanitizeMatchupOverrides(matchupOverrides) ?? {};
    const resolvedSeed = randomSeed !== undefined ? Number(randomSeed) : undefined;

    // --- Fetch data (same as non-streaming route) ---
    const supabase = createPublicClient();

    const { data: teamSeasonRows, error: teamSeasonsError } = await supabase
      .from("team_seasons")
      .select("*, teams!inner(*), coaches(*)")
      .eq("season", seasonNum)
      .order("team_id");

    if (teamSeasonsError || !teamSeasonRows?.length) {
      if (teamSeasonsError) {
        logger.error("Stream: error fetching team seasons", teamSeasonsError);
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: teamSeasonsError
            ? "Failed to fetch team data. Please try again."
            : `No team data found for season ${seasonNum}.`,
        }),
        {
          status: teamSeasonsError ? 500 : 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: tournamentEntries, error: entriesError } = await supabase
      .from("tournament_entries")
      .select("*")
      .eq("season", seasonNum);

    if (entriesError || !tournamentEntries?.length) {
      if (entriesError) {
        logger.error("Stream: error fetching tournament entries", entriesError);
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: entriesError
            ? "Failed to fetch tournament entries. Please try again."
            : `No tournament entries found for season ${seasonNum}.`,
        }),
        {
          status: entriesError ? 500 : 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data: sitesRows } = await supabase
      .from("tournament_sites")
      .select("*")
      .eq("season", seasonNum);

    const allTeamSeasons = transformTeamSeasonRows(
      teamSeasonRows as unknown as TeamSeasonJoinedRow[],
      tournamentEntries as unknown as TournamentEntryRow[]
    );

    const allTournamentTeams = allTeamSeasons.filter(
      (ts): ts is TeamSeason & { tournamentEntry: NonNullable<TeamSeason["tournamentEntry"]> } =>
        ts.tournamentEntry !== undefined
    );

    const { teams: tournamentTeams, playInConfig } = processTournamentField(allTournamentTeams);

    // Validate team count: 64 (no play-ins) or 68 (with play-ins)
    const expectedCount = playInConfig ? 68 : 64;
    if (tournamentTeams.length !== expectedCount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Expected ${expectedCount} tournament teams, found ${tournamentTeams.length}.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let siteMap: SiteMap | undefined;
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
          regions: row.regions ? (row.regions as Region[]) : undefined,
          season: row.season,
        })
      );
      const matchups = buildBracketMatchups(playInConfig);
      siteMap = buildSiteMap(matchups, sites);
    }

    const teamsMap = new Map<string, TeamSeason>();
    for (const team of tournamentTeams) {
      teamsMap.set(team.teamId, team);
    }

    const resolvedPicks = (picks as Record<string, string>) ?? {};

    const simulationConfig: SimulationConfig = {
      numSimulations: numSimsValue,
      engineConfig: resolvedConfig,
      matchupOverrides:
        Object.keys(resolvedOverrides).length > 0 ? resolvedOverrides : undefined,
      picks:
        Object.keys(resolvedPicks).length > 0 ? resolvedPicks : undefined,
      playInConfig: playInConfig ?? undefined,
      randomSeed: resolvedSeed,
    };

    // --- Stream the simulation ---
    const stream = new ReadableStream({
      start(controller) {
        try {
          const result = runSimulation(
            teamsMap,
            simulationConfig,
            siteMap,
            (progress) => {
              controller.enqueue(sseEvent("progress", progress));
            },
            1000 // report every 1000 sims
          );

          controller.enqueue(sseEvent("result", { success: true, result }));
          controller.close();
        } catch (err) {
          logger.error("Streaming simulation engine error", err instanceof Error ? err : undefined);
          controller.enqueue(
            sseEvent("error", { success: false, error: "Simulation failed." })
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logger.error(
      "Streaming simulation error",
      error instanceof Error ? error : undefined
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "An unexpected error occurred during simulation.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
