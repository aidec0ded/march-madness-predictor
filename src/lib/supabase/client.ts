/**
 * Supabase client initialization for the March Madness Bracket Predictor.
 *
 * Provides two client factories:
 *
 * - `createBrowserClient()` — For client-side React components. Uses the
 *   public anon key which respects Row Level Security (RLS) policies.
 *
 * - `createServerClient()` — For API routes and server components. Uses the
 *   service role key which bypasses RLS. Only call this server-side.
 *
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL — The Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY — The public anon key (safe for browser)
 * - SUPABASE_SERVICE_ROLE_KEY — The service role key (server-side only)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

// ---------------------------------------------------------------------------
// Environment variable helpers
// ---------------------------------------------------------------------------

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_URL. " +
        "Set this to your Supabase project URL."
    );
  }
  return url;
}

function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Set this to your Supabase public anon key."
    );
  }
  return key;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing environment variable: SUPABASE_SERVICE_ROLE_KEY. " +
        "Set this to your Supabase service role key. " +
        "This key should NEVER be exposed to the browser."
    );
  }
  return key;
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/**
 * Creates a Supabase client for browser-side usage.
 *
 * Uses the public anon key, which means all queries go through Row Level
 * Security (RLS). Suitable for client-side React components.
 *
 * @returns A typed Supabase client scoped to the public schema.
 */
export function createBrowserClient(): SupabaseClient<Database> {
  return createClient<Database>(getSupabaseUrl(), getAnonKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/**
 * Creates a Supabase client for server-side usage (API routes, server components).
 *
 * Uses the service role key, which bypasses RLS. This should ONLY be used in
 * server-side code (API routes, server components, build scripts).
 *
 * IMPORTANT: Never import or call this function from client-side code.
 *
 * @returns A typed Supabase client with admin-level access.
 */
export function createServerClient(): SupabaseClient<Database> {
  return createClient<Database>(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
