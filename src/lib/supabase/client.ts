/**
 * Supabase client factories for the March Madness Bracket Predictor.
 *
 * Five client variants:
 * - createBrowserClient()    — Client components (cookie-based auth via @supabase/ssr)
 * - createServerClient()     — Server components & Route Handlers (reads cookies from next/headers)
 * - createMiddlewareClient() — Middleware only (read/write on request/response)
 * - createPublicClient()     — Server-only, anon key, respects RLS (for public read-only routes)
 * - createAdminClient()      — Server-only, bypasses RLS (service role key, admin operations only)
 */

import {
  createBrowserClient as _createBrowserClient,
  createServerClient as _createServerClient,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

import type { Database } from "./types";

// ---------------------------------------------------------------------------
// Environment variable helpers
// ---------------------------------------------------------------------------

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return key;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return key;
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/**
 * Browser client — for client-side React components.
 * Uses @supabase/ssr which automatically handles cookies.
 */
export function createBrowserClient() {
  return _createBrowserClient<Database>(getSupabaseUrl(), getAnonKey());
}

/**
 * Server client — for Server Components and Route Handlers.
 * Requires the cookieStore from `await cookies()` in next/headers.
 */
export function createServerClient(cookieStore: {
  getAll: () => { name: string; value: string }[];
  set: (
    name: string,
    value: string,
    options?: Record<string, unknown>
  ) => void;
}) {
  return _createServerClient<Database>(getSupabaseUrl(), getAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as Record<string, unknown>);
          });
        } catch {
          // setAll is called from Server Components where cookies can't be set.
          // This is safe to ignore if middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Middleware client — for Next.js middleware.
 * Reads cookies from request, writes updated cookies to response.
 */
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return _createServerClient<Database>(getSupabaseUrl(), getAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

/**
 * Public client — server-only, uses anon key, respects RLS.
 * Use for public API routes that read team/tournament data without auth.
 * Requires anon SELECT policies on the target tables (see migration 006).
 * No session overhead — lightweight for high-throughput endpoints.
 */
export function createPublicClient() {
  return createClient<Database>(getSupabaseUrl(), getAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Admin client — server-only, bypasses RLS using service role key.
 * Use ONLY for admin operations, data imports, and migrations.
 * NEVER use in public-facing API routes. NEVER expose to client-side code.
 */
export function createAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
