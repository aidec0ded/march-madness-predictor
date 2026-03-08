/**
 * Admin authentication helper for API routes.
 *
 * Supports two authentication methods:
 * 1. Supabase Auth — checks user's app_metadata.role === 'admin'
 * 2. API Key (fallback) — checks x-admin-key header for scripts/CI
 */

import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks whether the incoming request has valid admin credentials.
 *
 * First tries Supabase Auth (cookie-based), then falls back to API key.
 *
 * @param request - The incoming HTTP request.
 * @returns `true` if the request has valid admin credentials, `false` otherwise.
 *
 * @example
 * ```ts
 * export async function POST(request: Request) {
 *   if (!(await isAdmin(request))) {
 *     return NextResponse.json(
 *       { success: false, error: "Unauthorized" },
 *       { status: 401 },
 *     );
 *   }
 *   // ... admin-only logic
 * }
 * ```
 */
export async function isAdmin(request: Request): Promise<boolean> {
  // Method 1: Supabase Auth — check user's app_metadata role
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.app_metadata?.role === "admin") {
      return true;
    }
  } catch {
    // cookies() may fail in non-Next.js contexts (e.g., scripts)
  }

  // Method 2: API Key fallback (for scripts, CI, external tools)
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    return false;
  }

  const providedKey = request.headers.get("x-admin-key");

  if (!providedKey || providedKey.length !== adminKey.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  let mismatch = 0;
  for (let i = 0; i < adminKey.length; i++) {
    mismatch |= providedKey.charCodeAt(i) ^ adminKey.charCodeAt(i);
  }

  return mismatch === 0;
}
