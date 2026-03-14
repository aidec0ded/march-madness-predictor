/**
 * API Route: /api/lever-configs/[id]
 *
 * GET    — Get a specific lever configuration
 * PUT    — Update a specific lever configuration
 * DELETE — Delete a specific lever configuration
 */

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { safeApiError } from "@/lib/api-error";
import { createRateLimiter } from "@/lib/rate-limit";
import type { UserLeverConfigUpdate } from "@/lib/supabase/types";

const rateLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("user_lever_configs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    const safe = safeApiError("Failed to load lever config.", error, "lever-configs/[id]/GET");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ leverConfig: data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlPut = rateLimiter.check(user.id);
  if (!rlPut.allowed) {
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

  const updates: UserLeverConfigUpdate = {};
  if (body.name !== undefined) updates.name = body.name as string;
  if (body.global_levers !== undefined)
    updates.global_levers = body.global_levers as Record<string, unknown>;
  if (body.matchup_overrides !== undefined)
    updates.matchup_overrides =
      body.matchup_overrides as Record<string, unknown>;
  if (body.is_default !== undefined)
    updates.is_default = body.is_default as boolean;

  const { data, error } = await supabase
    .from("user_lever_configs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    const safe = safeApiError("Failed to update lever config.", error, "lever-configs/[id]/PUT");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ leverConfig: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rlDel = rateLimiter.check(user.id);
  if (!rlDel.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { error } = await supabase
    .from("user_lever_configs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    const safe = safeApiError("Failed to delete lever config.", error, "lever-configs/[id]/DELETE");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ success: true });
}
