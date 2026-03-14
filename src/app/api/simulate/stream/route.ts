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
    const resolvedConfig = resolveEngineConfig(sanitizedConfig);

    const resolvedOverrides = sanitizeMatchupOverrides(matchupOverrides) ?? {};
    const resolvedSeed = randomSeed !== undefined ? Number(randomSeed) : undefined;

    // --- Fetch data (shared with non-streaming route) ---
    const fetchResult = await fetchSimulationData(seasonNum);
    if ("error" in fetchResult) {
      return new Response(
        JSON.stringify({ success: false, error: fetchResult.error.message }),
        {
          status: fetchResult.error.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { teamsMap, playInConfig, siteMap } = fetchResult.data;

    const resolvedPicks = sanitizePicks(picks) ?? {};

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
      async start(controller) {
        try {
          const result = await runSimulation(
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
