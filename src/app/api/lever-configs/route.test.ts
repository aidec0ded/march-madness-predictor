/**
 * Tests for /api/lever-configs route handlers.
 *
 * Verifies that:
 * - Unauthenticated requests receive 401
 * - Authenticated GET returns user lever configs
 * - Authenticated POST creates a lever config
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

import { GET, POST } from "./route";

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

describe("GET /api/lever-configs", () => {
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

  it("returns lever configs for authenticated user", async () => {
    const configs = [
      { id: "lc1", name: "Default Config", global_levers: {} },
    ];

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({ data: configs, error: null }),
            }),
          }),
        }),
      },
      user: mockUser,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.leverConfigs).toEqual(configs);
  });

  it("returns 500 on database error", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                data: null,
                error: { message: "connection refused" },
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
    expect(body.error).toBe("connection refused");
  });
});

describe("POST /api/lever-configs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const request = new Request("http://localhost/api/lever-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Custom Config" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("creates a lever config for authenticated user", async () => {
    const newConfig = {
      id: "lc-new",
      name: "Custom Config",
      user_id: "user-123",
    };

    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => ({ data: newConfig, error: null }),
            }),
          }),
        }),
      },
      user: mockUser,
    });

    const request = new Request("http://localhost/api/lever-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Custom Config" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.leverConfig).toEqual(newConfig);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: mockUser,
    });

    const request = new Request("http://localhost/api/lever-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON in request body");
  });
});
