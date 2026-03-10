/**
 * Tests for Next.js auth middleware.
 *
 * Verifies that:
 * - Unauthenticated users are redirected from protected routes to sign-in
 * - Authenticated users are redirected away from auth pages to /
 * - Unprotected routes pass through for both auth states
 * - The redirect parameter is preserved when redirecting to sign-in
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createMiddlewareClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

import { middleware } from "./middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated users", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
    });

    it("redirects from /dashboard to /auth/sign-in with redirect param", async () => {
      const request = createRequest("/dashboard");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/auth/sign-in");
      expect(location).toContain("redirect=%2Fdashboard");
    });

    it("redirects from /settings to /auth/sign-in", async () => {
      const request = createRequest("/settings");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/auth/sign-in");
      expect(location).toContain("redirect=%2Fsettings");
    });

    it("redirects from /brackets to /auth/sign-in", async () => {
      const request = createRequest("/brackets");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/auth/sign-in");
      expect(location).toContain("redirect=%2Fbrackets");
    });

    it("redirects from nested protected routes", async () => {
      const request = createRequest("/brackets/123/edit");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/auth/sign-in");
    });

    it("allows access to auth pages", async () => {
      const request = createRequest("/auth/sign-in");
      const response = await middleware(request);

      // Should NOT redirect — just pass through (200)
      expect(response.status).toBe(200);
    });

    it("allows access to the home page", async () => {
      const request = createRequest("/");
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("allows access to public routes", async () => {
      const request = createRequest("/about");
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });
  });

  describe("authenticated users", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    });

    it("redirects from /auth/sign-in to /", async () => {
      const request = createRequest("/auth/sign-in");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("http://localhost:3000/");
      // Should NOT contain /auth/ in the redirect target
      expect(location).not.toContain("/auth/sign-in");
    });

    it("redirects from /auth/sign-up to /", async () => {
      const request = createRequest("/auth/sign-up");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(new URL(location!).pathname).toBe("/");
    });

    it("redirects from /auth/forgot-password to /", async () => {
      const request = createRequest("/auth/forgot-password");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(new URL(location!).pathname).toBe("/");
    });

    it("redirects from /auth/reset-password to /", async () => {
      const request = createRequest("/auth/reset-password");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(new URL(location!).pathname).toBe("/");
    });

    it("allows access to protected routes", async () => {
      const request = createRequest("/dashboard");
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("allows access to /brackets", async () => {
      const request = createRequest("/brackets");
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("allows access to /settings", async () => {
      const request = createRequest("/settings");
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });

    it("allows access to the home page", async () => {
      const request = createRequest("/");
      const response = await middleware(request);

      expect(response.status).toBe(200);
    });
  });
});
