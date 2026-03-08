import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Email confirmation route handler.
 *
 * Handles the email verification link that Supabase sends after sign-up.
 * Verifies the OTP token and redirects the user to the home page on success.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL("/", origin));
    }
  }

  // If verification failed, redirect to sign-in with error
  return NextResponse.redirect(
    new URL("/auth/sign-in?error=verification", request.url)
  );
}
