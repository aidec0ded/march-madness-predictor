/**
 * API Route: /api/brackets
 *
 * GET  — List the authenticated user's brackets
 * POST — Create a new bracket for the authenticated user
 */

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase/server";
import { safeApiError } from "@/lib/api-error";
import type { UserBracketInsert } from "@/lib/supabase/types";

export async function GET() {
  const { supabase, user } = await createAuthenticatedClient();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    season: (body.season as number) || 2026,
    picks: (body.picks as Record<string, unknown>) || {},
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
