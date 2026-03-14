import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/client";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/settings", "/brackets"];

// Routes only for unauthenticated users
const AUTH_ROUTES = [
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/forgot-password",
  "/auth/reset-password",
];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createMiddlewareClient(request, response);

  // Refresh session — this is the primary purpose of middleware
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users from protected routes
  if (!user && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const redirectUrl = new URL("/auth/sign-in", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Admin API route protection (defense-in-depth; per-route isAdmin() checks remain)
  const ADMIN_API_PREFIX = "/api/admin";

  if (pathname.startsWith(ADMIN_API_PREFIX)) {
    // Check 1: Supabase auth — user must have admin role
    const isAuthAdmin = user?.app_metadata?.role === "admin";

    // Check 2: API key fallback
    const adminKey = process.env.ADMIN_API_KEY;
    const providedKey = request.headers.get("x-admin-key");
    const isKeyAdmin = !!(adminKey && providedKey && adminKey === providedKey);

    if (!isAuthAdmin && !isKeyAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
