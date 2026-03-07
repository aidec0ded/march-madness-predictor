/**
 * Torvik (barttorvik.com) data fetcher for the March Madness Bracket Predictor.
 *
 * Fetches team ratings and Four Factors data from barttorvik.com's static
 * CSV files, parses them, merges the two datasets by team name, and returns
 * an array of TorvikRawRow objects ready for the normalizer.
 *
 * This module is server-side only and should never be imported from client code.
 *
 * @module
 */

import { parseCsv } from "@/lib/data/csv-parser";
import type { TorvikRawRow } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base URL for Torvik static CSV files */
const TORVIK_BASE_URL = "https://barttorvik.com";

/** Crawl delay in milliseconds to respect robots.txt (10 seconds) */
const CRAWL_DELAY_MS = 10_000;

/**
 * Column headers for the team_results CSV.
 * The file is served with headers, but we define the mapping here for clarity
 * and to handle any naming inconsistencies. Columns are in positional order.
 */
const TEAM_RESULTS_HEADERS = [
  "rank",
  "team",
  "conf",
  "record",
  "adjoe",
  "oe_rank",
  "adjde",
  "de_rank",
  "barthag",
  "barthag_rank",
  "proj_w",
  "proj_l",
  "pro_con_w",
  "pro_con_l",
  "con_rec",
  "sos",
  "ncsos",
  "consos",
  "proj_sos",
  "proj_noncon_sos",
  "proj_con_sos",
  "elite_sos",
  "elite_noncon_sos",
  "opp_oe",
  "opp_de",
  "opp_proj_oe",
  "opp_proj_de",
  "con_adj_oe",
  "con_adj_de",
  "qual_o",
  "qual_d",
  "qual_barthag",
  "qual_games",
  "fun",
  "conpf",
  "conpa",
  "conposs",
  "conoe",
  "conde",
  "consosremain",
  "conf_win_pct",
  "wab",
  "wab_rk",
  "fun_rk",
  "adjt",
] as const;

/**
 * Column headers for the fffinal (Four Factors) CSV.
 * Columns alternate between stat values and their ranks.
 */
const FF_HEADERS = [
  "team",
  "efg_o",
  "efg_o_rk",
  "efg_d",
  "efg_d_rk",
  "ftr_o",
  "ftr_o_rk",
  "ftr_d",
  "ftr_d_rk",
  "orb_o",
  "orb_o_rk",
  "drb_d",
  "drb_d_rk",
  "to_o",
  "to_o_rk",
  "to_d",
  "to_d_rk",
  "threep_o",
  "threep_o_rk",
  "threep_d",
  "threep_d_rk",
  "twop_o",
  "twop_o_rk",
  "twop_d",
  "twop_d_rk",
  "ft_o",
  "ft_o_rk",
  "ft_d",
  "ft_d_rk",
  "threepr_o",
  "threepr_o_rk",
  "threepr_d",
  "threepr_d_rk",
  "arate_o",
  "arate_o_rk",
  "arate_d",
  "arate_d_rk",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result type for the Torvik data fetcher */
export interface TorvikFetchResult {
  /** Successfully parsed and merged Torvik data rows */
  data: TorvikRawRow[];
  /** Errors encountered during fetching, parsing, or merging */
  errors: string[];
}

/** Options for the Torvik data fetcher */
export interface TorvikFetchOptions {
  /**
   * Crawl delay in milliseconds between the two HTTP requests.
   * Defaults to 10000 (10 seconds) to respect barttorvik.com's robots.txt.
   * Set to 0 in tests to avoid waiting.
   */
  crawlDelayMs?: number;
}

/** Raw parsed row from the team_results CSV (all string values) */
type TeamResultsRow = Record<string, string>;

/** Raw parsed row from the fffinal CSV (all string values) */
type FourFactorsRow = Record<string, string>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely parses a string value to a number. Returns NaN if the value
 * cannot be parsed.
 */
function safeParseFloat(value: string | undefined): number {
  if (value === undefined || value === "") return NaN;
  const parsed = parseFloat(value);
  return parsed;
}

/**
 * Re-keys a CSV row using positional headers. The parseCsv function returns
 * rows keyed by whatever headers are in the first line. Since barttorvik
 * CSVs include headers, we use this to normalize the keys when the CSV
 * has its own headers that may use inconsistent casing/spacing.
 *
 * If the CSV already has good headers, this remaps from whatever the CSV
 * provided to our canonical names based on position.
 */
function remapRowByPosition(
  row: Record<string, string>,
  originalHeaders: string[],
  canonicalHeaders: readonly string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (
    let i = 0;
    i < originalHeaders.length && i < canonicalHeaders.length;
    i++
  ) {
    const originalKey = originalHeaders[i];
    const canonicalKey = canonicalHeaders[i];
    result[canonicalKey] = row[originalKey] ?? "";
  }
  return result;
}

/**
 * Extracts the header names from the first row of CSV content.
 * This is needed to remap columns by position.
 */
function extractHeaders(csvContent: string): string[] {
  const firstLineEnd = csvContent.indexOf("\n");
  const firstLine =
    firstLineEnd === -1 ? csvContent : csvContent.substring(0, firstLineEnd);
  // Split by comma, trim each header
  return firstLine
    .replace(/\r$/, "")
    .split(",")
    .map((h) => h.trim());
}

/**
 * Pauses execution for the specified duration.
 * Used to respect barttorvik.com's crawl delay.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a URL with error handling and returns the response text.
 */
async function fetchUrl(
  url: string
): Promise<{ text: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MarchMadnessPredictor/1.0 (educational project)",
        Accept: "text/csv, text/plain, */*",
      },
    });

    if (!response.ok) {
      return {
        text: "",
        error: `HTTP ${response.status} ${response.statusText} fetching ${url}`,
      };
    }

    const text = await response.text();
    return { text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      text: "",
      error: `Network error fetching ${url}: ${message}`,
    };
  }
}

/**
 * Merges team_results and fffinal data into TorvikRawRow objects.
 *
 * The team_results CSV provides efficiency ratings (adjoe, adjde) and tempo.
 * The fffinal CSV provides Four Factors and shooting splits.
 * Both are matched by team name.
 */
function mergeTeamData(
  teamResultsRows: TeamResultsRow[],
  fourFactorsRows: FourFactorsRow[],
  errors: string[]
): TorvikRawRow[] {
  // Build a lookup map from the Four Factors data keyed by normalized team name
  const ffMap = new Map<string, FourFactorsRow>();
  for (const ffRow of fourFactorsRows) {
    const teamName = (ffRow.team ?? "").trim().toLowerCase();
    if (teamName) {
      ffMap.set(teamName, ffRow);
    }
  }

  const result: TorvikRawRow[] = [];

  for (let i = 0; i < teamResultsRows.length; i++) {
    const tr = teamResultsRows[i];
    const teamName = (tr.team ?? "").trim();

    if (!teamName) {
      errors.push(`Row ${i}: Missing team name in team_results, skipping`);
      continue;
    }

    // Look up Four Factors data by normalized team name
    const ff = ffMap.get(teamName.toLowerCase());

    // Parse team_results fields
    const adjOE = safeParseFloat(tr.adjoe);
    const adjDE = safeParseFloat(tr.adjde);
    const adjT = safeParseFloat(tr.adjt);
    const barthag = safeParseFloat(tr.barthag);

    if (isNaN(adjOE) || isNaN(adjDE)) {
      errors.push(
        `Row ${i} (${teamName}): Missing or invalid efficiency ratings (adjoe=${tr.adjoe}, adjde=${tr.adjde}), skipping`
      );
      continue;
    }

    // Build the TorvikRawRow, using Four Factors data if available
    const row: TorvikRawRow = {
      team: teamName,
      conf: (tr.conf ?? "").trim(),
      barthag: isNaN(barthag) ? 0 : barthag,
      adj_o: adjOE,
      adj_d: adjDE,
      adj_t: isNaN(adjT) ? 0 : adjT,
      // Four Factors and shooting — from fffinal if available, otherwise NaN
      efg_o: ff ? safeParseFloat(ff.efg_o) : NaN,
      efg_d: ff ? safeParseFloat(ff.efg_d) : NaN,
      to_o: ff ? safeParseFloat(ff.to_o) : NaN,
      to_d: ff ? safeParseFloat(ff.to_d) : NaN,
      orb_o: ff ? safeParseFloat(ff.orb_o) : NaN,
      orb_d: ff ? safeParseFloat(ff.drb_d) : NaN,
      ftr_o: ff ? safeParseFloat(ff.ftr_o) : NaN,
      ftr_d: ff ? safeParseFloat(ff.ftr_d) : NaN,
      "3p_o": ff ? safeParseFloat(ff.threep_o) : NaN,
      "3p_d": ff ? safeParseFloat(ff.threep_d) : NaN,
      "3pr_o": ff ? safeParseFloat(ff.threepr_o) : NaN,
      "3pr_d": ff ? safeParseFloat(ff.threepr_d) : NaN,
      ft_o: ff ? safeParseFloat(ff.ft_o) : NaN,
      ft_d: ff ? safeParseFloat(ff.ft_d) : NaN,
    };

    if (!ff) {
      errors.push(
        `Row ${i} (${teamName}): No matching Four Factors data found; shooting/factors fields will be incomplete`
      );
    }

    result.push(row);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches Torvik team data for a given season from barttorvik.com.
 *
 * Makes two HTTP requests:
 * 1. Team results CSV — contains efficiency ratings and tempo
 * 2. Four Factors CSV — contains Four Factors and shooting splits
 *
 * The two datasets are merged by team name and returned as `TorvikRawRow[]`,
 * ready to be passed to the `normalizeTorvik()` normalizer.
 *
 * A 10-second delay is inserted between the two requests to respect
 * barttorvik.com's robots.txt crawl delay directive.
 *
 * @param season - The season year (e.g., 2025 for the 2024-25 season).
 * @param options - Optional configuration (e.g., override crawl delay for testing).
 * @returns An object with the merged data and any errors encountered.
 *
 * @example
 * ```ts
 * const { data, errors } = await fetchTorvikData(2025);
 * if (errors.length > 0) console.warn("Fetch warnings:", errors);
 * const normalized = normalizeTorvik(data, 2025);
 * ```
 */
export async function fetchTorvikData(
  season: number,
  options: TorvikFetchOptions = {}
): Promise<TorvikFetchResult> {
  const { crawlDelayMs = CRAWL_DELAY_MS } = options;
  const errors: string[] = [];

  // --- Validate season parameter ---
  if (!Number.isInteger(season) || season < 2002 || season > 2100) {
    return {
      data: [],
      errors: [
        `Invalid season: ${season}. Must be an integer between 2002 and 2100.`,
      ],
    };
  }

  // --- Fetch team_results CSV ---
  const teamResultsUrl = `${TORVIK_BASE_URL}/${season}_team_results.csv`;
  const teamResultsResponse = await fetchUrl(teamResultsUrl);

  if (teamResultsResponse.error) {
    return {
      data: [],
      errors: [teamResultsResponse.error],
    };
  }

  if (!teamResultsResponse.text.trim()) {
    return {
      data: [],
      errors: [`Empty response from ${teamResultsUrl}`],
    };
  }

  // Parse team_results CSV
  let teamResultsRawRows: Record<string, string>[];
  try {
    teamResultsRawRows = parseCsv(teamResultsResponse.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: [],
      errors: [`Failed to parse team_results CSV: ${message}`],
    };
  }

  if (teamResultsRawRows.length === 0) {
    return {
      data: [],
      errors: [`No data rows found in team_results CSV from ${teamResultsUrl}`],
    };
  }

  // Remap headers by position to our canonical names
  const trOriginalHeaders = extractHeaders(teamResultsResponse.text);
  const teamResultsRows: TeamResultsRow[] = teamResultsRawRows.map((row) =>
    remapRowByPosition(row, trOriginalHeaders, TEAM_RESULTS_HEADERS)
  );

  // --- Respect crawl delay before second request ---
  if (crawlDelayMs > 0) {
    await delay(crawlDelayMs);
  }

  // --- Fetch fffinal (Four Factors) CSV ---
  const ffUrl = `${TORVIK_BASE_URL}/${season}_fffinal.csv`;
  const ffResponse = await fetchUrl(ffUrl);

  let fourFactorsRows: FourFactorsRow[] = [];

  if (ffResponse.error) {
    // Four Factors is supplementary — log warning but continue with team_results
    errors.push(
      `Warning: Could not fetch Four Factors data: ${ffResponse.error}. ` +
        "Proceeding with team_results data only; Four Factors fields will be incomplete."
    );
  } else if (!ffResponse.text.trim()) {
    errors.push(
      `Warning: Empty response from ${ffUrl}. ` +
        "Proceeding with team_results data only; Four Factors fields will be incomplete."
    );
  } else {
    try {
      const ffRawRows = parseCsv(ffResponse.text);
      const ffOriginalHeaders = extractHeaders(ffResponse.text);
      fourFactorsRows = ffRawRows.map((row) =>
        remapRowByPosition(row, ffOriginalHeaders, FF_HEADERS)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(
        `Warning: Failed to parse Four Factors CSV: ${message}. ` +
          "Proceeding with team_results data only; Four Factors fields will be incomplete."
      );
    }
  }

  // --- Merge datasets ---
  const data = mergeTeamData(teamResultsRows, fourFactorsRows, errors);

  return { data, errors };
}
