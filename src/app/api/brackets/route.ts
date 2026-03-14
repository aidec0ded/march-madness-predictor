/**
 * API Route: /api/brackets
 *
 * GET  — List the authenticated user's brackets
 * POST — Create a new bracket for the authenticated user
 */

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { safeApiError } from "@/lib/api-error";
import { createRateLimiter } from "@/lib/rate-limit";
import type { UserBracketInsert } from "@/lib/supabase/types";
import { CURRENT_SEASON } from "@/lib/constants";

const rateLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });

export async function GET() {
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("user_brackets")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    const safe = safeApiError("Failed to load brackets.", error, "brackets/GET");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ brackets: data });
}

export async function POST(request: Request) {
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const insertData: UserBracketInsert = {
    user_id: user.id,
    name: (body.name as string) || "My Bracket",
    season: (body.season as number) || CURRENT_SEASON,
    picks: (body.picks as Record<string, unknown>) || {},
    global_levers: (body.global_levers as Record<string, unknown>) || {},
    matchup_overrides: (body.matchup_overrides as Record<string, unknown>) || {},
    simulation_snapshot: (body.simulation_snapshot as Record<string, unknown>) || null,
  };

  const { data, error } = await supabase
    .from("user_brackets")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    const safe = safeApiError("Failed to create bracket.", error, "brackets/POST");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ bracket: data }, { status: 201 });
}
