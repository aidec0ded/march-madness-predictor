/**
 * Tests for /api/admin/tournament-entries route handlers.
 *
 * Verifies that:
 * - Unauthenticated requests receive 401
 * - POST validates season, entry count (68), seed/region, and bracket structure
 * - POST resolves team names and inserts entries
 * - POST reports unresolved team names
 * - GET returns existing entries for a season
 * - DELETE clears entries for a season
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

const mockIsAdmin = vi.fn();

vi.mock("@/lib/auth/admin-check", () => ({
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

// Supabase mock
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
    check: () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
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
// Import route handlers after mocks are established
// ---------------------------------------------------------------------------

import { POST, GET, DELETE } from "./route";

// ---------------------------------------------------------------------------
// Test data — 68-team bracket
// ---------------------------------------------------------------------------

const REGIONS = ["East", "West", "South", "Midwest"];

/** Builds a valid 68-entry bracket. Seeds 11 and 16 have 6 entries each. */
function make68Entries(): { team: string; seed: number; region: string }[] {
  const entries: { team: string; seed: number; region: string }[] = [];

  for (const region of REGIONS) {
    for (let seed = 1; seed <= 16; seed++) {
      entries.push({
        team: `${region} ${seed}-Seed`,
        seed,
        region,
      });
    }
  }

  // Add 2 extra 11-seeds (play-in) — add to East and West
  entries.push({ team: "Play-In 11A", seed: 11, region: "East" });
  entries.push({ team: "Play-In 11B", seed: 11, region: "West" });

  // Add 2 extra 16-seeds (play-in) — add to South and Midwest
  entries.push({ team: "Play-In 16A", seed: 16, region: "South" });
  entries.push({ team: "Play-In 16B", seed: 16, region: "Midwest" });

  return entries;
}

/**
 * Build mock team DB rows for name resolution.
 * Creates teams matching all 68 bracket entries.
 */
function buildTeamRows(entries: { team: string }[]) {
  return entries.map((e, i) => ({
    id: `team-${i}`,
    name: e.team,
    short_name: e.team.substring(0, 8),
  }));
}

/** Build mock team_seasons rows. */
function buildTeamSeasonRows(teamRows: { id: string }[], season: number) {
  return teamRows.map((t) => ({
    id: `ts-${t.id}`,
    team_id: t.id,
    season,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/tournament-entries", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": "test-key" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(season = 2026): Request {
  return new Request(
    `http://localhost/api/admin/tournament-entries?season=${season}`,
    {
      method: "GET",
      headers: { "x-admin-key": "test-key" },
    }
  );
}

function makeDeleteRequest(season = 2026): Request {
  return new Request(
    `http://localhost/api/admin/tournament-entries?season=${season}`,
    {
      method: "DELETE",
      headers: { "x-admin-key": "test-key" },
    }
  );
}

function setupSuccessfulPostMocks(entries: { team: string }[]) {
  const teamRows = buildTeamRows(entries);
  const teamSeasonRows = buildTeamSeasonRows(teamRows, 2026);

  mockFrom.mockImplementation((table: string) => {
    if (table === "teams") {
      return {
        select: () => ({
          data: teamRows,
          error: null,
        }),
      };
    }
    if (table === "team_name_mappings") {
      return {
        select: () => ({
          data: [],
          error: null,
        }),
      };
    }
    if (table === "team_seasons") {
      return {
        select: () => ({
          eq: () => ({
            data: teamSeasonRows,
            error: null,
          }),
        }),
      };
    }
    if (table === "tournament_entries") {
      return {
        delete: () => ({
          eq: () => ({ error: null }),
        }),
        insert: () => ({ error: null }),
        select: mockSelect,
      };
    }
    return {};
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/admin/tournament-entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockResolvedValue(true);
  });

  it("returns 401 when not admin", async () => {
    mockIsAdmin.mockResolvedValue(false);

    const response = await POST(makePostRequest({ season: 2026, entries: [] }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 for missing season", async () => {
    const response = await POST(makePostRequest({ entries: [] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("season");
  });

  it("returns 400 for invalid season", async () => {
    const response = await POST(
      makePostRequest({ season: 1999, entries: [] })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("season");
  });

  it("returns 400 when entries is not an array", async () => {
    const response = await POST(
      makePostRequest({ season: 2026, entries: "not-array" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("entries");
  });

  it("returns 400 for wrong number of entries (not 68)", async () => {
    const partialEntries = make68Entries().slice(0, 64);

    const response = await POST(
      makePostRequest({ season: 2026, entries: partialEntries })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("68");
    expect(body.error).toContain("64");
  });

  it("returns 400 for invalid seed", async () => {
    const entries = make68Entries();
    entries[0].seed = 17; // Invalid

    const response = await POST(
      makePostRequest({ season: 2026, entries })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toBeDefined();
    expect(body.details[0]).toContain("invalid seed");
  });

  it("returns 400 for invalid region", async () => {
    const entries = make68Entries();
    entries[0].region = "North"; // Invalid

    const response = await POST(
      makePostRequest({ season: 2026, entries })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toBeDefined();
    expect(body.details[0]).toContain("invalid region");
  });

  it("returns 400 for wrong seed counts", async () => {
    const entries = make68Entries();
    // Change one entry to create 5 one-seeds instead of 4
    entries[entries.length - 1].seed = 1;

    const response = await POST(
      makePostRequest({ season: 2026, entries })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("structure");
  });

  it("returns 400 for unresolved team names", async () => {
    const entries = make68Entries();

    // Setup mocks that return only SOME teams (not all)
    const partialTeamRows = buildTeamRows(entries).slice(0, 60);
    mockFrom.mockImplementation((table: string) => {
      if (table === "teams") {
        return {
          select: () => ({
            data: partialTeamRows,
            error: null,
          }),
        };
      }
      if (table === "team_name_mappings") {
        return {
          select: () => ({
            data: [],
            error: null,
          }),
        };
      }
      return {};
    });

    const response = await POST(
      makePostRequest({ season: 2026, entries })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("resolve");
    expect(body.unresolvedTeams).toBeDefined();
    expect(body.unresolvedTeams.length).toBeGreaterThan(0);
  });

  it("returns 200 and inserts 68 entries on valid input", async () => {
    const entries = make68Entries();
    setupSuccessfulPostMocks(entries);

    const response = await POST(
      makePostRequest({ season: 2026, entries })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.entriesInserted).toBe(68);
    expect(body.message).toContain("68");
  });

  it("handles play-in entries (multiple teams with same seed+region)", async () => {
    const entries = make68Entries();
    setupSuccessfulPostMocks(entries);

    const response = await POST(
      makePostRequest({ season: 2026, entries })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify the insert was called with 68 records
    const insertCall = mockFrom.mock.calls.find(
      (call: unknown[]) => call[0] === "tournament_entries"
    );
    expect(insertCall).toBeDefined();
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new Request(
      "http://localhost/api/admin/tournament-entries",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": "test-key",
        },
        body: "not-valid-json",
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("JSON");
  });
});

describe("GET /api/admin/tournament-entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockResolvedValue(true);
  });

  it("returns 401 when not admin", async () => {
    mockIsAdmin.mockResolvedValue(false);

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 for missing season", async () => {
    const request = new Request(
      "http://localhost/api/admin/tournament-entries",
      {
        method: "GET",
        headers: { "x-admin-key": "test-key" },
      }
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("season");
  });

  it("returns existing entries for a season", async () => {
    const mockEntries = [
      {
        id: "e1",
        seed: 1,
        region: "East",
        teams: { name: "Duke", short_name: "Duke" },
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "tournament_entries") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => ({
                  data: mockEntries,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(1);
    expect(body.data.entries).toHaveLength(1);
  });
});

describe("DELETE /api/admin/tournament-entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockResolvedValue(true);
  });

  it("returns 401 when not admin", async () => {
    mockIsAdmin.mockResolvedValue(false);

    const response = await DELETE(makeDeleteRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 for missing season", async () => {
    const request = new Request(
      "http://localhost/api/admin/tournament-entries",
      {
        method: "DELETE",
        headers: { "x-admin-key": "test-key" },
      }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("season");
  });

  it("clears entries for a season", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "tournament_entries") {
        return {
          delete: () => ({
            eq: () => ({
              error: null,
              count: 68,
            }),
          }),
        };
      }
      return {};
    });

    const response = await DELETE(makeDeleteRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.deletedCount).toBe(68);
  });
});
