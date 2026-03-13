/**
 * Safe API error handling utility.
 *
 * Logs the full error server-side (for debugging/monitoring) and returns
 * a generic message to the client (preventing schema/internal details from leaking).
 */

import { logger } from "@/lib/logger";

interface SafeApiErrorResult {
  /** Generic, user-safe error message */
  message: string;
  /** HTTP status code */
  status: number;
}

/**
 * Logs the real error server-side and returns a safe message for the client.
 *
 * Handles known Supabase PostgREST error codes:
 * - PGRST116: No rows found → 404
 * - All others → 500 with generic message
 *
 * @param clientMessage - The generic message to return to the client
 * @param error - The actual error (logged server-side, never sent to client)
 * @param context - Optional context string for the log entry (e.g., "brackets/GET")
 */
export function safeApiError(
  clientMessage: string,
  error: unknown,
  context?: string
): SafeApiErrorResult {
  // Log the full error details server-side
  logger.error(
    context || clientMessage,
    error instanceof Error ? error : undefined
  );

  // Check for specific Supabase PostgREST error codes
  const code = (error as { code?: string })?.code;
  if (code === "PGRST116") {
    return { message: "Not found.", status: 404 };
  }

  return { message: clientMessage, status: 500 };
}
