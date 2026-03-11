/**
 * Tests for /api/admin/tournament-sites route handlers.
 *
 * Verifies that:
 * - Unauthenticated requests receive 401
 * - POST validates season, site data, coordinates, rounds, regions
 * - POST upserts sites correctly
 * - GET returns existing sites for a season
 * - DELETE clears sites for a season
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

const mockIsAdmin = vi.fn();

vi.mock("@/lib/auth/admin-check", () => ({
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({
    check: () => ({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60000,
    }),
  }),
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import route handlers after mocks
// ---------------------------------------------------------------------------

import { POST, GET, DELETE as DELETE_HANDLER } from "./route";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeSites() {
  return [
    {
      name: "Dayton - R64",
      city: "Dayton",
      state: "Ohio",
      latitude: 39.7589,
      longitude: -84.1916,
      rounds: ["R64"],
      regions: [],
    },
    {
      name: "Buffalo - R64/R32",
      city: "Buffalo",
      state: "New York",
      latitude: 42.8864,
      longitude: -78.8784,
      rounds: ["R64", "R32"],
      regions: ["South", "East"],
    },
    {
      name: "Indianapolis - F4/NCG",
      city: "Indianapolis",
      state: "Indiana",
      latitude: 39.7684,
      longitude: -86.1581,
      rounds: ["F4", "NCG"],
      regions: [],
    },
  ];
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/admin/tournament-sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(season: number) {
  return new Request(
    `http://localhost/api/admin/tournament-sites?season=${season}`,
    { method: "GET" }
  );
}

function makeDeleteRequest(season: number) {
  return new Request(
    `http://localhost/api/admin/tournament-sites?season=${season}`,
    { method: "DELETE" }
  );
}

// ---------------------------------------------------------------------------
// Supabase chain helpers
// ---------------------------------------------------------------------------

function setupDeleteThenInsertSuccess() {
  // First call: from("tournament_sites") for delete
  // Second call: from("tournament_sites") for insert
  let callCount = 0;
  mockFrom.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // DELETE chain
      return {
        delete: () => ({
          eq: () => ({ error: null }),
        }),
      };
    }
    // INSERT chain
    return {
      insert: () => ({ error: null }),
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/admin/tournament-sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not admin", async () => {
    mockIsAdmin.mockResolvedValue(false);
    const res = await POST(makeRequest({ season: 2026, sites: makeSites() }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing season", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const res = await POST(makeRequest({ sites: makeSites() }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("season");
  });

  it("returns 400 for invalid season", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const res = await POST(
      makeRequest({ season: 1999, sites: makeSites() })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty sites array", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const res = await POST(makeRequest({ season: 2026, sites: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("non-empty");
  });

  it("returns 400 for invalid latitude", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const sites = [
      {
        name: "Bad Site",
        city: "Nowhere",
        state: "XX",
        latitude: 999,
        longitude: -80,
        rounds: ["R64"],
      },
    ];
    const res = await POST(makeRequest({ season: 2026, sites }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("latitude");
  });

  it("returns 400 for invalid rounds", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const sites = [
      {
        name: "Bad Site",
        city: "City",
        state: "ST",
        latitude: 40,
        longitude: -80,
        rounds: ["INVALID_ROUND"],
      },
    ];
    const res = await POST(makeRequest({ season: 2026, sites }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("INVALID_ROUND");
  });

  it("returns 400 for invalid regions", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const sites = [
      {
        name: "Bad Site",
        city: "City",
        state: "ST",
        latitude: 40,
        longitude: -80,
        rounds: ["R64"],
        regions: ["InvalidRegion"],
      },
    ];
    const res = await POST(makeRequest({ season: 2026, sites }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("InvalidRegion");
  });

  it("returns 200 and inserts valid sites", async () => {
    mockIsAdmin.mockResolvedValue(true);
    setupDeleteThenInsertSuccess();

    const res = await POST(
      makeRequest({ season: 2026, sites: makeSites() })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(3);
  });

  it("returns 400 for missing city", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const sites = [
      {
        name: "Bad Site",
        state: "ST",
        latitude: 40,
        longitude: -80,
        rounds: ["R64"],
      },
    ];
    const res = await POST(makeRequest({ season: 2026, sites }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("city");
  });

  it("returns 400 for empty rounds array", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const sites = [
      {
        name: "Bad Site",
        city: "City",
        state: "ST",
        latitude: 40,
        longitude: -80,
        rounds: [],
      },
    ];
    const res = await POST(makeRequest({ season: 2026, sites }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("rounds");
  });
});

describe("GET /api/admin/tournament-sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not admin", async () => {
    mockIsAdmin.mockResolvedValue(false);
    const res = await GET(makeGetRequest(2026));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing season", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const res = await GET(
      new Request("http://localhost/api/admin/tournament-sites", {
        method: "GET",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns sites for a season", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const mockSites = [
      { id: "1", name: "Dayton", city: "Dayton", state: "Ohio" },
    ];
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ data: mockSites, error: null }),
        }),
      }),
    });

    const res = await GET(makeGetRequest(2026));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sites).toEqual(mockSites);
  });
});

describe("DELETE /api/admin/tournament-sites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not admin", async () => {
    mockIsAdmin.mockResolvedValue(false);
    const res = await DELETE_HANDLER(makeDeleteRequest(2026));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing season", async () => {
    mockIsAdmin.mockResolvedValue(true);
    const res = await DELETE_HANDLER(
      new Request("http://localhost/api/admin/tournament-sites", {
        method: "DELETE",
      })
    );
    expect(res.status).toBe(400);
  });

  it("deletes sites for a season", async () => {
    mockIsAdmin.mockResolvedValue(true);
    mockFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({ error: null }),
      }),
    });

    const res = await DELETE_HANDLER(makeDeleteRequest(2026));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
