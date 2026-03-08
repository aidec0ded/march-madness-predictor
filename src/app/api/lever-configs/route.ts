/**
 * API Route: /api/lever-configs
 *
 * GET  — List the authenticated user's lever configurations
 * POST — Create a new lever configuration for the authenticated user
 */

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import type { UserLeverConfigInsert } from "@/lib/supabase/types";

export async function GET() {
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_lever_configs")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leverConfigs: data });
}

export async function POST(request: Request) {
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

  const insertData: UserLeverConfigInsert = {
    user_id: user.id,
    name: (body.name as string) || "Default Config",
    season: (body.season as number) || 2026,
    global_levers: (body.global_levers as Record<string, unknown>) || {},
    matchup_overrides:
      (body.matchup_overrides as Record<string, unknown>) || {},
    is_default: (body.is_default as boolean) || false,
  };

  const { data, error } = await supabase
    .from("user_lever_configs")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leverConfig: data }, { status: 201 });
}
