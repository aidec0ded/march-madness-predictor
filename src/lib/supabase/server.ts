/**
 * Server-side Supabase helper for authenticated API routes.
 *
 * Creates a cookie-based Supabase client using @supabase/ssr and extracts
 * the current user. Returns null user if not authenticated.
 *
 * This helper creates a per-request client that respects RLS policies
 * using the anon key + user session cookies. It does NOT use the
 * service role key (which bypasses RLS).
 *
 * After merge with Branch A (auth-core), this may be consolidated
 * with the main client module.
 */

import { cookies } from "next/headers";
import { createServerClient as _createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

export async function createAuthenticatedClient() {
  const cookieStore = await cookies();

  const supabase = _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
            // Server Components can't set cookies — this is expected
            // when called from a Server Component context rather than
            // a Route Handler.
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}
