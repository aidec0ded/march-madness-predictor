/**
 * API Route: /api/brackets/[id]
 *
 * GET    — Get a specific bracket
 * PUT    — Update a specific bracket
 * DELETE — Delete a specific bracket
 */

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { safeApiError } from "@/lib/api-error";
import type { UserBracketUpdate } from "@/lib/supabase/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_brackets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    const safe = safeApiError("Failed to load bracket.", error, "brackets/[id]/GET");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ bracket: data });
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const updates: UserBracketUpdate = {};
  if (body.name !== undefined) updates.name = body.name as string;
  if (body.picks !== undefined)
    updates.picks = body.picks as Record<string, unknown>;
  if (body.global_levers !== undefined)
    updates.global_levers = body.global_levers as Record<string, unknown>;
  if (body.matchup_overrides !== undefined)
    updates.matchup_overrides = body.matchup_overrides as Record<string, unknown>;
  if (body.simulation_snapshot !== undefined)
    updates.simulation_snapshot =
      body.simulation_snapshot as Record<string, unknown> | null;
  if (body.is_active !== undefined) updates.is_active = body.is_active as boolean;

  const { data, error } = await supabase
    .from("user_brackets")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    const safe = safeApiError("Failed to update bracket.", error, "brackets/[id]/PUT");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ bracket: data });
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

  const { error } = await supabase
    .from("user_brackets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    const safe = safeApiError("Failed to delete bracket.", error, "brackets/[id]/DELETE");
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }

  return NextResponse.json({ success: true });
}
