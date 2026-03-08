import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/client";

/**
 * OAuth callback route handler.
 *
 * Handles the redirect from Supabase OAuth providers (Google, GitHub).
 * Exchanges the authorization code for a session, then redirects
 * the user to the originally requested page or the home page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(redirect, origin));
    }
  }

  // If no code or exchange failed, redirect to sign-in with error
  return NextResponse.redirect(
    new URL("/auth/sign-in?error=auth", request.url)
  );
}
