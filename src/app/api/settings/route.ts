/**
 * API Route: /api/settings
 *
 * GET — Get the authenticated user's settings
 * PUT — Update (upsert) the authenticated user's settings
 */

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import type { UserSettingsInsert } from "@/lib/supabase/types";

export async function GET() {
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned — that's fine, return defaults
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data || {
      pool_size_bucket: "medium",
      simulation_count: 10000,
      preferences: {},
    },
  });
}

export async function PUT(request: Request) {
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

  const upsertData: UserSettingsInsert = { user_id: user.id };
  if (body.pool_size_bucket !== undefined)
    upsertData.pool_size_bucket = body.pool_size_bucket as string;
  if (body.simulation_count !== undefined)
    upsertData.simulation_count = body.simulation_count as number;
  if (body.preferences !== undefined)
    upsertData.preferences = body.preferences as Record<string, unknown>;

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(upsertData, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
