/**
 * Tests for /api/settings route handlers.
 *
 * Verifies that:
 * - Unauthenticated requests receive 401
 * - Authenticated GET returns user settings (or defaults)
 * - Authenticated PUT upserts settings
 * - Invalid JSON body returns 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = { id: "user-123", email: "test@example.com" };
const mockCreateAuthenticatedClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

import { GET, PUT } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUnauthenticated() {
  mockCreateAuthenticatedClient.mockResolvedValue({
    supabase: { from: vi.fn() },
    user: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns user settings when authenticated", async () => {
    const settingsData = {
      pool_size_bucket: "large",
      simulation_count: 50000,
      preferences: { theme: "dark" },
    };

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => ({ data: settingsData, error: null }),
            }),
          }),
        }),
      },
      user: mockUser,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual(settingsData);
  });

  it("returns default settings when no rows found (PGRST116)", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => ({
                data: null,
                error: { code: "PGRST116", message: "No rows returned" },
              }),
            }),
          }),
        }),
      },
      user: mockUser,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual({
      pool_size_bucket: "medium",
      simulation_count: 10000,
      preferences: {},
    });
  });

  it("returns 500 on non-PGRST116 database error", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => ({
                data: null,
                error: { code: "42P01", message: "relation does not exist" },
              }),
            }),
          }),
        }),
      },
      user: mockUser,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to load settings.");
  });
});

describe("PUT /api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const request = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool_size_bucket: "large" }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("upserts settings for authenticated user", async () => {
    const upsertedData = {
      user_id: "user-123",
      pool_size_bucket: "large",
      simulation_count: 50000,
      preferences: {},
    };

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          upsert: () => ({
            select: () => ({
              single: () => ({ data: upsertedData, error: null }),
            }),
          }),
        }),
      },
      user: mockUser,
    });

    const request = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pool_size_bucket: "large",
        simulation_count: 50000,
      }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.settings).toEqual(upsertedData);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: mockUser,
    });

    const request = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json",
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON in request body");
  });
});
