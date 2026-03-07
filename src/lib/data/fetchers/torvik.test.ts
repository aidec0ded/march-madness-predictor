/**
 * Tests for the Torvik data fetcher.
 *
 * Uses mocked fetch to avoid real HTTP calls. Tests cover:
 * - Successful fetch and parse of team_results CSV
 * - Successful fetch and merge of fffinal CSV
 * - Network error handling
 * - Malformed CSV handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTorvikData } from "./torvik";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/**
 * Minimal valid team_results CSV content with headers and two data rows.
 * Column order matches the barttorvik.com format described in the spec.
 */
const VALID_TEAM_RESULTS_CSV = [
  "rank,team,conf,record,adjoe,oe Rank,adjde,de Rank,barthag,rank,proj. W,Proj. L,Pro Con W,Pro Con L,Con Rec.,sos,ncsos,consos,Proj. SOS,Proj. Noncon SOS,Proj. Con SOS,elite SOS,elite noncon SOS,Opp OE,Opp DE,Opp Proj. OE,Opp Proj DE,Con Adj OE,Con Adj DE,Qual O,Qual D,Qual Barthag,Qual Games,FUN,ConPF,ConPA,ConPoss,ConOE,ConDE,ConSOSRemain,Conf Win%,WAB,WAB Rk,Fun Rk,adjt",
  "1,Connecticut,Big East,28-3,126.1,1,88.2,3,0.9744,1,31,2,17,1,17-1,8.77,5.31,13.02,8.95,5.15,13.56,12.44,8.22,103.5,102.8,104.1,103.2,110.5,95.3,120.1,90.5,0.9512,12,95.2,78.3,68.2,66.8,117.2,102.1,6.55,94.4,6.8,1,2,68.4",
  "2,Houston,Big 12,29-2,121.5,3,86.9,1,0.9689,2,30,3,16,2,16-2,9.12,4.88,14.22,9.33,5.01,14.67,13.11,9.05,104.2,103.1,104.8,103.5,111.2,94.8,118.5,89.2,0.9478,11,93.8,76.1,67.5,67.2,113.4,100.5,7.12,88.9,6.2,3,5,64.8",
].join("\n");

/**
 * Minimal valid fffinal (Four Factors) CSV with matching team names.
 * Column order matches the barttorvik.com format described in the spec.
 */
const VALID_FF_CSV = [
  "TeamName,eFG%,Rk,eFG% Def,Rk,FTR,Rk,FTR Def,Rk,OR%,Rk,DR%,Rk,TO%,Rk,TO% Def.,Rk,3P%,rk,3pD%,rk,2p%,rk,2p%D,rk,ft%,rk,ft%D,rk,3P rate,rk,3P rate D,rk,arate,rk,arateD,rk",
  "Connecticut,57.3,2,44.8,5,38.5,15,26.2,8,33.8,12,23.5,20,15.8,35,22.1,10,38.2,8,29.5,15,58.1,3,45.2,10,76.2,22,69.1,55,36.8,25,31.2,42,18.5,8,16.2,12",
  "Houston,55.1,8,42.3,2,40.2,8,24.8,3,35.2,5,22.1,5,14.5,15,23.8,3,36.5,15,28.1,8,56.8,5,43.5,5,74.8,35,67.5,42,38.2,15,29.8,35,17.2,15,15.8,18",
].join("\n");

/**
 * team_results CSV with a malformed row (missing required fields).
 */
const MALFORMED_TEAM_RESULTS_CSV = [
  "rank,team,conf,record,adjoe,oe Rank,adjde,de Rank,barthag,rank,proj. W,Proj. L,Pro Con W,Pro Con L,Con Rec.,sos,ncsos,consos,Proj. SOS,Proj. Noncon SOS,Proj. Con SOS,elite SOS,elite noncon SOS,Opp OE,Opp DE,Opp Proj. OE,Opp Proj DE,Con Adj OE,Con Adj DE,Qual O,Qual D,Qual Barthag,Qual Games,FUN,ConPF,ConPA,ConPoss,ConOE,ConDE,ConSOSRemain,Conf Win%,WAB,WAB Rk,Fun Rk,adjt",
  "1,Connecticut,Big East,28-3,not_a_number,1,also_bad,3,0.9744,1,31,2,17,1,17-1,8.77,5.31,13.02,8.95,5.15,13.56,12.44,8.22,103.5,102.8,104.1,103.2,110.5,95.3,120.1,90.5,0.9512,12,95.2,78.3,68.2,66.8,117.2,102.1,6.55,94.4,6.8,1,2,68.4",
  "2,Houston,Big 12,29-2,121.5,3,86.9,1,0.9689,2,30,3,16,2,16-2,9.12,4.88,14.22,9.33,5.01,14.67,13.11,9.05,104.2,103.1,104.8,103.5,111.2,94.8,118.5,89.2,0.9478,11,93.8,76.1,67.5,67.2,113.4,100.5,7.12,88.9,6.2,3,5,64.8",
].join("\n");

/** Shared fetch options that skip crawl delay for fast tests */
const TEST_OPTIONS = { crawlDelayMs: 0 };

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

/** Helper to create a mock Response-like object for fetch */
function mockResponse(body: string, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    clone: () => mockResponse(body, status, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    json: () => Promise.resolve({}),
    bytes: () => Promise.resolve(new Uint8Array()),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchTorvikData", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Successful fetch & parse
  // -----------------------------------------------------------------------

  it("should fetch, parse, and merge team_results and fffinal CSVs", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(VALID_TEAM_RESULTS_CSV))
      .mockResolvedValueOnce(mockResponse(VALID_FF_CSV));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    // Should have fetched both URLs
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://barttorvik.com/2025_team_results.csv",
      expect.any(Object)
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://barttorvik.com/2025_fffinal.csv",
      expect.any(Object)
    );

    // Should have 2 teams
    expect(result.data).toHaveLength(2);

    // Verify Connecticut data
    const uconn = result.data.find((r) => r.team === "Connecticut");
    expect(uconn).toBeDefined();
    expect(uconn!.conf).toBe("Big East");
    expect(uconn!.adj_o).toBe(126.1);
    expect(uconn!.adj_d).toBe(88.2);
    expect(uconn!.adj_t).toBe(68.4);
    expect(uconn!.barthag).toBe(0.9744);

    // Four Factors from fffinal merge
    expect(uconn!.efg_o).toBe(57.3);
    expect(uconn!.efg_d).toBe(44.8);
    expect(uconn!.to_o).toBe(15.8);
    expect(uconn!.to_d).toBe(22.1);
    expect(uconn!.orb_o).toBe(33.8);
    expect(uconn!.ftr_o).toBe(38.5);
    expect(uconn!.ftr_d).toBe(26.2);

    // Shooting splits from fffinal merge
    expect(uconn!["3p_o"]).toBe(38.2);
    expect(uconn!["3p_d"]).toBe(29.5);
    expect(uconn!["3pr_o"]).toBe(36.8);
    expect(uconn!["3pr_d"]).toBe(31.2);
    expect(uconn!.ft_o).toBe(76.2);
    expect(uconn!.ft_d).toBe(69.1);

    // Verify Houston data
    const houston = result.data.find((r) => r.team === "Houston");
    expect(houston).toBeDefined();
    expect(houston!.conf).toBe("Big 12");
    expect(houston!.adj_o).toBe(121.5);
    expect(houston!.adj_d).toBe(86.9);

    // No critical errors (warnings about missing FF data are not expected here)
    const criticalErrors = result.errors.filter(
      (e) => !e.startsWith("Warning:")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  it("should use the correct season in the URL", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(VALID_TEAM_RESULTS_CSV))
      .mockResolvedValueOnce(mockResponse(VALID_FF_CSV));

    await fetchTorvikData(2023, TEST_OPTIONS);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://barttorvik.com/2023_team_results.csv",
      expect.any(Object)
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://barttorvik.com/2023_fffinal.csv",
      expect.any(Object)
    );
  });

  // -----------------------------------------------------------------------
  // team_results only (fffinal unavailable)
  // -----------------------------------------------------------------------

  it("should return data with warnings when fffinal fetch fails", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(VALID_TEAM_RESULTS_CSV))
      .mockResolvedValueOnce(mockResponse("", 404, "Not Found"));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    // Should still have teams from team_results
    expect(result.data).toHaveLength(2);

    // Efficiency ratings should be populated from team_results
    expect(result.data[0].adj_o).toBe(126.1);
    expect(result.data[0].adj_d).toBe(88.2);

    // Four Factors should be NaN (no fffinal data)
    expect(result.data[0].efg_o).toBeNaN();
    expect(result.data[0].to_o).toBeNaN();

    // Should have warnings about missing Four Factors
    expect(result.errors.some((e) => e.includes("Four Factors"))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Network errors
  // -----------------------------------------------------------------------

  it("should return an error when team_results fetch fails with network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network timeout"));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    expect(result.data).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Network error");
    expect(result.errors[0]).toContain("Network timeout");
  });

  it("should return an error when team_results returns HTTP error status", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse("", 500, "Internal Server Error")
    );

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    expect(result.data).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("HTTP 500");
  });

  it("should return an error when team_results returns empty content", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(""));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    expect(result.data).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Empty response");
  });

  it("should handle fffinal network error gracefully and still return team data", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(VALID_TEAM_RESULTS_CSV))
      .mockRejectedValueOnce(new Error("Connection refused"));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    // Should still have team data from team_results
    expect(result.data.length).toBeGreaterThan(0);
    // Should have warning about fffinal failure
    expect(result.errors.some((e) => e.includes("Four Factors"))).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Malformed CSV handling
  // -----------------------------------------------------------------------

  it("should skip rows with invalid efficiency ratings and report errors", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(MALFORMED_TEAM_RESULTS_CSV))
      .mockResolvedValueOnce(mockResponse(VALID_FF_CSV));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    // Only Houston should be in the result (Connecticut has bad adjoe/adjde)
    expect(result.data).toHaveLength(1);
    expect(result.data[0].team).toBe("Houston");

    // Should have an error about Connecticut's invalid ratings
    expect(
      result.errors.some(
        (e) => e.includes("Connecticut") && e.includes("invalid")
      )
    ).toBe(true);
  });

  it("should handle CSV with only a header row and no data rows", async () => {
    const headerOnly =
      "rank,team,conf,record,adjoe,oe Rank,adjde,de Rank,barthag,rank,proj. W,Proj. L,Pro Con W,Pro Con L,Con Rec.,sos,ncsos,consos,Proj. SOS,Proj. Noncon SOS,Proj. Con SOS,elite SOS,elite noncon SOS,Opp OE,Opp DE,Opp Proj. OE,Opp Proj DE,Con Adj OE,Con Adj DE,Qual O,Qual D,Qual Barthag,Qual Games,FUN,ConPF,ConPA,ConPoss,ConOE,ConDE,ConSOSRemain,Conf Win%,WAB,WAB Rk,Fun Rk,adjt";
    fetchSpy.mockResolvedValueOnce(mockResponse(headerOnly));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    expect(result.data).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("No data rows");
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  it("should reject invalid season values", async () => {
    const result1 = await fetchTorvikData(2001);
    expect(result1.data).toHaveLength(0);
    expect(result1.errors[0]).toContain("Invalid season");

    const result2 = await fetchTorvikData(2101);
    expect(result2.data).toHaveLength(0);
    expect(result2.errors[0]).toContain("Invalid season");

    const result3 = await fetchTorvikData(2025.5);
    expect(result3.data).toHaveLength(0);
    expect(result3.errors[0]).toContain("Invalid season");
  });

  // -----------------------------------------------------------------------
  // Team name matching
  // -----------------------------------------------------------------------

  it("should match team names case-insensitively between the two CSVs", async () => {
    const teamResultsCsv = [
      "rank,team,conf,record,adjoe,oe Rank,adjde,de Rank,barthag,rank,proj. W,Proj. L,Pro Con W,Pro Con L,Con Rec.,sos,ncsos,consos,Proj. SOS,Proj. Noncon SOS,Proj. Con SOS,elite SOS,elite noncon SOS,Opp OE,Opp DE,Opp Proj. OE,Opp Proj DE,Con Adj OE,Con Adj DE,Qual O,Qual D,Qual Barthag,Qual Games,FUN,ConPF,ConPA,ConPoss,ConOE,ConDE,ConSOSRemain,Conf Win%,WAB,WAB Rk,Fun Rk,adjt",
      "1,connecticut,Big East,28-3,126.1,1,88.2,3,0.9744,1,31,2,17,1,17-1,8.77,5.31,13.02,8.95,5.15,13.56,12.44,8.22,103.5,102.8,104.1,103.2,110.5,95.3,120.1,90.5,0.9512,12,95.2,78.3,68.2,66.8,117.2,102.1,6.55,94.4,6.8,1,2,68.4",
    ].join("\n");

    const ffCsv = [
      "TeamName,eFG%,Rk,eFG% Def,Rk,FTR,Rk,FTR Def,Rk,OR%,Rk,DR%,Rk,TO%,Rk,TO% Def.,Rk,3P%,rk,3pD%,rk,2p%,rk,2p%D,rk,ft%,rk,ft%D,rk,3P rate,rk,3P rate D,rk,arate,rk,arateD,rk",
      "Connecticut,57.3,2,44.8,5,38.5,15,26.2,8,33.8,12,23.5,20,15.8,35,22.1,10,38.2,8,29.5,15,58.1,3,45.2,10,76.2,22,69.1,55,36.8,25,31.2,42,18.5,8,16.2,12",
    ].join("\n");

    fetchSpy
      .mockResolvedValueOnce(mockResponse(teamResultsCsv))
      .mockResolvedValueOnce(mockResponse(ffCsv));

    const result = await fetchTorvikData(2025, TEST_OPTIONS);

    expect(result.data).toHaveLength(1);
    // Four Factors data should be present (matched case-insensitively)
    expect(result.data[0].efg_o).toBe(57.3);
    // No "No matching Four Factors" warning
    expect(
      result.errors.some((e) => e.includes("No matching Four Factors"))
    ).toBe(false);
  });
});
