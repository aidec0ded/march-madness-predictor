/**
 * KenPom multi-CSV merger for the March Madness Bracket Predictor.
 *
 * Takes up to 5 raw CSV strings (main, offense, defense, misc, height)
 * from separate KenPom exports, parses each with the generic CSV parser,
 * and merges them into a single flat array of KenPomMergedRow objects
 * keyed by TeamName. Only the main CSV is required; all others are optional
 * and augment the base row with additional fields.
 */

import { parseCsv } from "../csv-parser";
import type {
  KenPomMainCsvRow,
  KenPomOffenseCsvRow,
  KenPomDefenseCsvRow,
  KenPomMiscCsvRow,
  KenPomHeightCsvRow,
  KenPomMergedRow,
  KenPomCsvBundle,
} from "@/types/data-import";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of merging the KenPom CSV bundle. */
export interface KenPomMergeResult {
  /** Merged rows — one per team found in the main CSV. */
  data: KenPomMergedRow[];
  /** Non-fatal warnings (e.g., unmatched team names in optional CSVs). */
  warnings: string[];
  /** Number of rows parsed from each CSV file. */
  csvSummary: {
    main: number;
    offense: number;
    defense: number;
    misc: number;
    height: number;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely parses a string to a float. Returns null for missing, empty,
 * or "NULL" sentinel values.
 */
function safeParseFloat(value: string | undefined): number | null {
  if (
    value === undefined ||
    value === null ||
    value.trim() === "" ||
    value === "NULL"
  ) {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Normalizes a team name by trimming and collapsing internal whitespace
 * so that "  North  Carolina " matches "North Carolina".
 */
function normalizeTeamName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merges up to 5 KenPom CSV exports into a single array of KenPomMergedRow.
 *
 * The main CSV establishes the set of teams; optional CSVs augment rows
 * matched by TeamName. Teams present in optional CSVs but absent from the
 * main CSV are counted and reported as warnings.
 *
 * @param bundle - Object containing raw CSV content strings. Only `main`
 *   is required.
 * @returns Merged rows, warnings, and per-CSV row counts.
 */
export function mergeKenPomCsvs(bundle: KenPomCsvBundle): KenPomMergeResult {
  const warnings: string[] = [];
  const csvSummary = { main: 0, offense: 0, defense: 0, misc: 0, height: 0 };

  // ------------------------------------------------------------------
  // Parse main CSV (required)
  // ------------------------------------------------------------------
  const mainRows = parseCsv<KenPomMainCsvRow>(bundle.main);
  csvSummary.main = mainRows.length;

  // Build the team map from the main CSV
  const map = new Map<string, KenPomMergedRow>();

  for (const row of mainRows) {
    const name = normalizeTeamName(row.TeamName);
    if (!name) continue;

    map.set(name, {
      teamName: name,
      // Main CSV fields
      adjOE: safeParseFloat(row.AdjOE),
      adjDE: safeParseFloat(row.AdjDE),
      adjEM: safeParseFloat(row.AdjEM),
      adjTempo: safeParseFloat(row.AdjTempo),
      seed: row.seed && row.seed !== "NULL" ? row.seed.trim() : null,
      // Offense (populated later)
      offEfgPct: null,
      offToPct: null,
      offOrbPct: null,
      offFtRate: null,
      // Defense (populated later)
      defEfgPct: null,
      defToPct: null,
      defOrbPct: null,
      defFtRate: null,
      // Misc (populated later)
      offThreePtPct: null,
      offFtPct: null,
      offThreePtRate: null,
      defThreePtPct: null,
      defFtPct: null,
      defThreePtRate: null,
      twoFoulParticipation: null,
      // Height (populated later)
      avgHeight: null,
      experience: null,
      benchMinutesPct: null,
      minutesContinuity: null,
    });
  }

  // ------------------------------------------------------------------
  // Helper: augment existing rows from an optional CSV
  // ------------------------------------------------------------------
  function augment<T extends { TeamName: string }>(
    csvName: string,
    rows: T[],
    apply: (row: T, merged: KenPomMergedRow) => void
  ): void {
    let unmatched = 0;
    for (const row of rows) {
      const name = normalizeTeamName(row.TeamName);
      const merged = map.get(name);
      if (merged) {
        apply(row, merged);
      } else {
        unmatched++;
      }
    }
    if (unmatched > 0) {
      warnings.push(
        `${csvName}: ${unmatched} team(s) not found in main CSV`
      );
    }
  }

  // ------------------------------------------------------------------
  // Parse and merge offense CSV
  // ------------------------------------------------------------------
  if (bundle.offense) {
    const rows = parseCsv<KenPomOffenseCsvRow>(bundle.offense);
    csvSummary.offense = rows.length;
    augment("offense", rows, (row, m) => {
      m.offEfgPct = safeParseFloat(row.eFGPct);
      m.offToPct = safeParseFloat(row.TOPct);
      m.offOrbPct = safeParseFloat(row.ORPct);
      m.offFtRate = safeParseFloat(row.FTRate);
    });
  }

  // ------------------------------------------------------------------
  // Parse and merge defense CSV
  // ------------------------------------------------------------------
  if (bundle.defense) {
    const rows = parseCsv<KenPomDefenseCsvRow>(bundle.defense);
    csvSummary.defense = rows.length;
    augment("defense", rows, (row, m) => {
      m.defEfgPct = safeParseFloat(row.eFGPct);
      m.defToPct = safeParseFloat(row.TOPct);
      m.defOrbPct = safeParseFloat(row.ORPct);
      m.defFtRate = safeParseFloat(row.FTRate);
    });
  }

  // ------------------------------------------------------------------
  // Parse and merge misc CSV
  // ------------------------------------------------------------------
  if (bundle.misc) {
    const rows = parseCsv<KenPomMiscCsvRow>(bundle.misc);
    csvSummary.misc = rows.length;
    augment("misc", rows, (row, m) => {
      m.offThreePtPct = safeParseFloat(row.FG3Pct);
      m.offThreePtRate = safeParseFloat(row.FG3Rate);
      m.offFtPct = safeParseFloat(row.FTPct);
      m.defThreePtPct = safeParseFloat(row.OppFG3Pct);
      m.defThreePtRate = safeParseFloat(row.OppFG3Rate);
      m.defFtPct = safeParseFloat(row.OppFTPct);
      // Note: The DFP column in KenPom's misc CSV is NOT 2-Foul Participation.
      // It's always NULL in recent seasons, and in older seasons it's an
      // unrelated metric (values ranging from -15 to +25). The actual 2-Foul
      // Participation stat is only visible on individual team pages and is not
      // included in any exportable CSV. We intentionally ignore DFP here.
    });
  }

  // ------------------------------------------------------------------
  // Parse and merge height CSV
  // ------------------------------------------------------------------
  if (bundle.height) {
    const rows = parseCsv<KenPomHeightCsvRow>(bundle.height);
    csvSummary.height = rows.length;
    augment("height", rows, (row, m) => {
      m.avgHeight = safeParseFloat(row.Size);
      m.experience = safeParseFloat(row.Exp);
      m.benchMinutesPct = safeParseFloat(row.Bench);
      m.minutesContinuity = safeParseFloat(row.Continuity);
    });
  }

  return {
    data: Array.from(map.values()),
    warnings,
    csvSummary,
  };
}
