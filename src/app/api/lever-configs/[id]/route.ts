/**
 * API Route: /api/lever-configs/[id]
 *
 * GET    — Get a specific lever configuration
 * PUT    — Update a specific lever configuration
 * DELETE — Delete a specific lever configuration
 */

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import type { UserLeverConfigUpdate } from "@/lib/supabase/types";

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
    .from("user_lever_configs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
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
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
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

  const { error } = await supabase
    .from("user_lever_configs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
