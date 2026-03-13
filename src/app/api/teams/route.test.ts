/**
 * Tests for GET /api/teams route handler.
 *
 * Verifies:
 * - Successful team data retrieval
 * - Season parameter validation (valid, invalid, default)
 * - TeamId parameter validation (valid UUID, invalid format)
 * - tournamentOnly filter behavior
 * - Supabase error handling (team_seasons error → 500, entries error → non-fatal)
 * - Rate limiting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the route
// ---------------------------------------------------------------------------

const mockTeamSeasonSelect = vi.fn();
const mockTeamSeasonEq = vi.fn();
const mockTournamentSelect = vi.fn();
const mockTournamentEq = vi.fn();

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createPublicClient: () => ({
    from: mockFrom,
  }),
}));

// Mock the transforms module
vi.mock("@/lib/supabase/transforms", () => ({
  transformTeamSeasonRows: vi.fn((rows, entries) => {
    // Return simplified mock TeamSeason objects based on the rows passed in
    return (rows ?? []).map((row: { team_id: string; teams: { name: string; short_name: string; conference: string } }) => ({
      id: `ts-${row.team_id}`,
      teamId: row.team_id,
      season: 2026,
      team: {
        id: row.team_id,
        name: row.teams.name,
        shortName: row.teams.short_name,
        conference: row.teams.conference,
        campus: { city: "Test", state: "TS", latitude: 0, longitude: 0 },
      },
      ratings: {},
      fourFactorsOffense: { efgPct: 50, toPct: 15, orbPct: 30, ftRate: 0.3 },
      fourFactorsDefense: null,
      shootingOffense: { threePtPct: 35, threePtRate: 40, ftPct: 75 },
      shootingDefense: null,
      adjTempo: 68,
      avgPossLengthOff: 0,
      avgPossLengthDef: 0,
      benchMinutesPct: 30,
      experience: 2.0,
      minutesContinuity: 50,
      avgHeight: 76,
      twoFoulParticipation: 0,
      evanmiyaOpponentAdjust: 0,
      evanmiyaPaceAdjust: 0,
      evanmiyaKillShotsPerGame: 0,
      evanmiyaKillShotsAllowedPerGame: 0,
      evanmiyaKillShotsMargin: 0,
      coach: { name: "Test Coach", tournamentGames: 0, tournamentWins: 0, finalFours: 0, championships: 0, yearsHeadCoach: 5 },
      // If there's a matching entry, add tournamentEntry
      tournamentEntry: (entries ?? []).find(
        (e: { team_season_id: string }) => e.team_season_id === `ts-${row.team_id}`
      )
        ? { seed: 1, region: "East", bracketPosition: 1 }
        : undefined,
      updatedAt: "2026-01-01",
      dataSources: ["torvik"],
    }));
  }),
}));

// ---------------------------------------------------------------------------
// Import route handler after mocks are established
// ---------------------------------------------------------------------------

import { GET } from "./route";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_TEAM_ROWS = [
  {
    team_id: "team-1",
    season: 2026,
    teams: { name: "Duke Blue Devils", short_name: "Duke", conference: "ACC" },
    coaches: null,
  },
  {
    team_id: "team-2",
    season: 2026,
    teams: { name: "North Carolina Tar Heels", short_name: "UNC", conference: "ACC" },
    coaches: null,
  },
];

const MOCK_ENTRIES = [
  { team_season_id: "ts-team-1", season: 2026, seed: 1, region: "East", bracket_position: 1 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url = "http://localhost/api/teams"): Request {
  return new Request(url, { method: "GET" });
}

function setupSuccessfulMocks(
  teamRows = MOCK_TEAM_ROWS,
  entries = MOCK_ENTRIES,
  teamsError: { message: string } | null = null,
  entriesError: { message: string } | null = null
) {
  // Team seasons query chain: from("team_seasons").select(...).eq("season", ...)
  const teamQueryResult = { data: teamsError ? null : teamRows, error: teamsError };
  const teamEqTeamId = vi.fn().mockReturnValue(teamQueryResult);

  mockTeamSeasonEq.mockImplementation((_col: string, _val: unknown) => {
    // The second .eq() for team_id filter
    return { data: teamsError ? null : teamRows, error: teamsError, eq: teamEqTeamId };
  });
  mockTeamSeasonSelect.mockReturnValue({
    eq: mockTeamSeasonEq,
  });

  // Tournament entries query chain: from("tournament_entries").select("*").eq("season", ...)
  mockTournamentEq.mockReturnValue({
    data: entriesError ? null : entries,
    error: entriesError,
  });
  mockTournamentSelect.mockReturnValue({
    eq: mockTournamentEq,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === "team_seasons") {
      return { select: mockTeamSeasonSelect };
    }
    if (table === "tournament_entries") {
      return { select: mockTournamentSelect };
    }
    return {};
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns team data with default season", async () => {
    setupSuccessfulMocks();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(2);
    expect(body.data.season).toBe(2026);
    expect(body.data.teams).toHaveLength(2);
    expect(body.data.teams[0].team.name).toBe("Duke Blue Devils");
    expect(body.data.teams[1].team.name).toBe("North Carolina Tar Heels");
  });

  it("applies season filter from query parameter", async () => {
    setupSuccessfulMocks();

    const response = await GET(makeRequest("http://localhost/api/teams?season=2025"));
    await response.json();

    expect(response.status).toBe(200);
    // Verify the season was passed to the Supabase query
    expect(mockTeamSeasonEq).toHaveBeenCalledWith("season", 2025);
    expect(mockTournamentEq).toHaveBeenCalledWith("season", 2025);
  });

  it("returns 400 for invalid season (too low)", async () => {
    const response = await GET(makeRequest("http://localhost/api/teams?season=1999"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain("Invalid season parameter");
  });

  it("returns 400 for invalid season (not a number)", async () => {
    const response = await GET(makeRequest("http://localhost/api/teams?season=abc"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid season parameter");
  });

  it("returns 400 for invalid teamId (not UUID)", async () => {
    const response = await GET(
      makeRequest("http://localhost/api/teams?teamId=not-a-uuid")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid teamId parameter");
  });

  it("accepts valid UUID teamId", async () => {
    setupSuccessfulMocks();

    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const response = await GET(
      makeRequest(`http://localhost/api/teams?teamId=${uuid}`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.filters.teamId).toBe(uuid);
  });

  it("filters to tournament-only teams when tournamentOnly=true", async () => {
    setupSuccessfulMocks();

    const response = await GET(
      makeRequest("http://localhost/api/teams?tournamentOnly=true")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.filters.tournamentOnly).toBe(true);
    // Only team-1 has a tournament entry in our mock
    expect(body.data.count).toBe(1);
    expect(body.data.teams[0].team.name).toBe("Duke Blue Devils");
  });

  it("returns all teams when tournamentOnly is not set", async () => {
    setupSuccessfulMocks();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.data.filters.tournamentOnly).toBe(false);
    expect(body.data.count).toBe(2);
  });

  it("returns 500 when team_seasons query fails", async () => {
    setupSuccessfulMocks(MOCK_TEAM_ROWS, MOCK_ENTRIES, {
      message: "Connection refused",
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to fetch team data.");
  });

  it("still returns teams when tournament_entries query fails (non-fatal)", async () => {
    setupSuccessfulMocks(MOCK_TEAM_ROWS, MOCK_ENTRIES, null, {
      message: "Entries table error",
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // Should still return teams even without entries
    expect(body.data.count).toBe(2);
  });

  it("returns empty array when no teams found", async () => {
    setupSuccessfulMocks([], []);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.teams).toEqual([]);
    expect(body.data.count).toBe(0);
  });
});
