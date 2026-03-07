/**
 * Admin authentication helper for API routes.
 *
 * Provides a simple API key-based admin check for protecting admin-only
 * endpoints (data import, configuration, etc.).
 *
 * This is a temporary auth mechanism that checks for an `x-admin-key`
 * header matching the `ADMIN_API_KEY` environment variable. It will be
 * replaced by Supabase Auth role-based checks in Phase 4.
 *
 * Environment variables required:
 * - ADMIN_API_KEY — The secret key for admin API access
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks whether the incoming request has valid admin credentials.
 *
 * Looks for an `x-admin-key` header and compares it against the
 * `ADMIN_API_KEY` environment variable using constant-time-safe
 * string comparison (via length check + character comparison).
 *
 * @param request - The incoming HTTP request.
 * @returns `true` if the request has a valid admin key, `false` otherwise.
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
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    // If ADMIN_API_KEY is not configured, reject all requests.
    // This prevents accidental open access in misconfigured environments.
    console.warn(
      "ADMIN_API_KEY environment variable is not set. All admin requests will be rejected."
    );
    return false;
  }

  const providedKey = request.headers.get("x-admin-key");

  if (!providedKey) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks.
  // First check length, then compare character by character.
  if (providedKey.length !== adminKey.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < adminKey.length; i++) {
    mismatch |= providedKey.charCodeAt(i) ^ adminKey.charCodeAt(i);
  }

  return mismatch === 0;
}
