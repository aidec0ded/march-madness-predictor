/**
 * API Route: POST /api/narrative
 *
 * Generates an AI matchup narrative using Claude.
 *
 * Pipeline:
 * 1. Authenticate user via Supabase session
 * 2. Rate limit: 10 requests per minute per user
 * 3. Validate request body shape
 * 4. Build prompt from structured data
 * 5. Stream Claude response as SSE
 *
 * Response format: text/event-stream
 *   data: {"text":"..."}\n\n      — partial text chunk
 *   data: {"done":true}\n\n       — generation complete
 *   data: {"error":"..."}\n\n     — error occurred
 */

import Anthropic from "@anthropic-ai/sdk";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { buildNarrativePrompt } from "@/lib/narrative/prompt-builder";
import type { NarrativeRequest } from "@/types/narrative";

// ---------------------------------------------------------------------------
// Rate Limiting (in-memory, per-user)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

/**
 * Check and update rate limit for a user.
 * @returns true if the request is allowed, false if rate limited
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------

function isValidNarrativeRequest(body: unknown): body is NarrativeRequest {
  if (typeof body !== "object" || body === null) return false;
  const req = body as Record<string, unknown>;

  // Check required top-level fields
  if (typeof req.gameId !== "string") return false;
  if (typeof req.round !== "string") return false;
  if (typeof req.probA !== "number") return false;
  if (typeof req.spread !== "number") return false;
  if (typeof req.poolSizeBucket !== "string") return false;
  if (typeof req.ownershipA !== "number") return false;
  if (typeof req.ownershipB !== "number") return false;
  if (typeof req.leverageA !== "number") return false;
  if (typeof req.leverageB !== "number") return false;
  if (typeof req.poolDescription !== "string") return false;

  // Check team data objects exist
  if (typeof req.teamAData !== "object" || req.teamAData === null) return false;
  if (typeof req.teamBData !== "object" || req.teamBData === null) return false;

  // Check breakdown exists
  if (typeof req.breakdown !== "object" || req.breakdown === null) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Anthropic Client
// ---------------------------------------------------------------------------

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key") {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Authenticate
  const { user } = await createAuthenticatedClient();

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Sign in to generate narratives." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Rate limit
  if (!checkRateLimit(user.id)) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please wait a moment before generating another narrative.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Parse and validate request
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON in request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!isValidNarrativeRequest(body)) {
    return new Response(
      JSON.stringify({ error: "Invalid request shape. Missing required fields." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. Build prompt
  const { system, userMessage } = buildNarrativePrompt(body);

  // 5. Stream Claude response
  let anthropic: Anthropic;
  try {
    anthropic = getAnthropicClient();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initialize AI client";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content: userMessage }],
        });

        // Stream text events
        response.on("text", (text) => {
          const data = JSON.stringify({ text });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        });

        // Wait for the stream to complete
        await response.finalMessage();

        // Send done signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate narrative";
        const data = JSON.stringify({ error: message });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
