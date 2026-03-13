/**
 * Tests for /api/brackets route handlers.
 *
 * Verifies that:
 * - Unauthenticated requests receive 401
 * - Authenticated GET returns user brackets
 * - Authenticated POST creates a bracket
 * - Invalid JSON body returns 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

const mockUser = { id: "user-123", email: "test@example.com" };

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

const mockCreateAuthenticatedClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
}));

// We must mock next/headers since the server module may call cookies()
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Import route handlers after mocks are established
// ---------------------------------------------------------------------------

import { GET, POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildChain() {
  // Chain: from().select().eq().order()
  mockOrder.mockReturnValue({
    data: [{ id: "b1", name: "My Bracket" }],
    error: null,
  });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
  // Chain for insert: from().insert().select().single()
  mockSingle.mockReturnValue({
    data: { id: "b-new", name: "My Bracket" },
    error: null,
  });
  mockInsert.mockReturnValue({
    select: () => ({ single: mockSingle }),
  });
}

function mockAuthenticated() {
  buildChain();
  mockCreateAuthenticatedClient.mockResolvedValue({
    supabase: { from: mockFrom },
    user: mockUser,
  });
}

function mockUnauthenticated() {
  mockCreateAuthenticatedClient.mockResolvedValue({
    supabase: { from: mockFrom },
    user: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/brackets", () => {
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

  it("returns brackets for authenticated user", async () => {
    mockAuthenticated();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.brackets).toEqual([{ id: "b1", name: "My Bracket" }]);
    expect(mockFrom).toHaveBeenCalledWith("user_brackets");
  });

  it("returns 500 on database error", async () => {
    mockCreateAuthenticatedClient.mockResolvedValue({
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                data: null,
                error: { message: "DB connection failed" },
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
    expect(body.error).toBe("Failed to load brackets.");
  });
});

describe("POST /api/brackets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUnauthenticated();

    const request = new Request("http://localhost/api/brackets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Bracket" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("creates a bracket for authenticated user", async () => {
    mockAuthenticated();

    const request = new Request("http://localhost/api/brackets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My New Bracket", season: 2026 }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.bracket).toEqual({ id: "b-new", name: "My Bracket" });
    expect(mockFrom).toHaveBeenCalledWith("user_brackets");
  });

  it("returns 400 for invalid JSON body", async () => {
    mockAuthenticated();

    const request = new Request("http://localhost/api/brackets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON in request body");
  });
});
