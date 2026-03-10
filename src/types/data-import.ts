/**
 * Types for the admin data import pipeline.
 *
 * Defines the shape of raw data from each source before normalization,
 * and the import/validation result types.
 */

import { DataSource } from "./team";

// ---------------------------------------------------------------------------
// Raw data formats (as received from each source)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use the multi-CSV pipeline types (KenPomMainCsvRow, etc.) instead.
 * Kept temporarily for backward compatibility with the import API route.
 */
export interface KenPomRawRow {
  Team: string;
  Conf: string;
  AdjEM: string;
  AdjO: string;
  AdjD: string;
  AdjT: string;
  "OE-eFG%": string;
  "OE-TO%": string;
  "OE-OR%": string;
  "OE-FTR": string;
  "DE-eFG%": string;
  "DE-TO%": string;
  "DE-OR%": string;
  "DE-FTR": string;
  "3P%": string;
  "3PA/FGA": string;
  "FT%": string;
  "Opp3P%": string;
  "Opp3PA/FGA": string;
  "OppFT%": string;
  AvgPossOff: string;
  AvgPossDef: string;
  "BenchMin%": string;
  Experience: string;
  Continuity: string;
  AvgHgt: string;
  "2FoulPart": string;
  [key: string]: string; // Allow additional fields
}

// ---------------------------------------------------------------------------
// KenPom multi-CSV pipeline types
// ---------------------------------------------------------------------------

/**
 * Row from the main KenPom summary export CSV.
 * All values are strings (CSV parser returns strings).
 */
export interface KenPomMainCsvRow {
  Season: string;
  TeamName: string;
  Tempo: string;
  RankTempo: string;
  AdjTempo: string;
  RankAdjTempo: string;
  OE: string;
  RankOE: string;
  AdjOE: string;
  RankAdjOE: string;
  DE: string;
  RankDE: string;
  AdjDE: string;
  RankAdjDE: string;
  AdjEM: string;
  RankAdjEM: string;
  seed: string;
  [key: string]: string;
}

/**
 * Row from the KenPom offensive Four Factors CSV export.
 */
export interface KenPomOffenseCsvRow {
  Season: string;
  TeamName: string;
  eFGPct: string;
  RankeFGPct: string;
  TOPct: string;
  RankTOPct: string;
  ORPct: string;
  RankORPct: string;
  FTRate: string;
  RankFTRate: string;
  [key: string]: string;
}

/**
 * Row from the KenPom defensive Four Factors CSV export.
 * Same field names as offense (values are defensive).
 */
export interface KenPomDefenseCsvRow {
  Season: string;
  TeamName: string;
  eFGPct: string;
  RankeFGPct: string;
  TOPct: string;
  RankTOPct: string;
  ORPct: string;
  RankORPct: string;
  FTRate: string;
  RankFTRate: string;
  [key: string]: string;
}

/**
 * Row from the KenPom miscellaneous stats CSV export.
 */
export interface KenPomMiscCsvRow {
  Season: string;
  TeamName: string;
  FG2Pct: string;
  RankFG2Pct: string;
  FG3Pct: string;
  RankFG3Pct: string;
  FTPct: string;
  RankFTPct: string;
  BlockPct: string;
  RankBlockPct: string;
  OppFG2Pct: string;
  RankOppFG2Pct: string;
  OppFG3Pct: string;
  RankOppFG3Pct: string;
  OppFTPct: string;
  RankOppFTPct: string;
  OppBlockPct: string;
  RankOppBlockPct: string;
  FG3Rate: string;
  RankFG3Rate: string;
  OppFG3Rate: string;
  RankOppFG3Rate: string;
  ARate: string;
  RankARate: string;
  OppARate: string;
  RankOppARate: string;
  StlRate: string;
  RankStlRate: string;
  OppStlRate: string;
  RankOppStlRate: string;
  DFP: string;
  NSTRate: string;
  RankNSTRate: string;
  OppNSTRate: string;
  RankOppNSTRate: string;
  [key: string]: string;
}

/**
 * Row from the KenPom height/experience CSV export.
 * Includes positional height data columns we don't use (captured by index sig).
 */
export interface KenPomHeightCsvRow {
  Season: string;
  TeamName: string;
  Size: string;
  SizeRank: string;
  Exp: string;
  ExpRank: string;
  Bench: string;
  BenchRank: string;
  Continuity: string;
  RankContinuity: string;
  HgtEff: string;
  HgtEffRank: string;
  [key: string]: string;
}

/**
 * A single team row after all KenPom CSVs have been merged.
 * Numeric fields are pre-parsed; null means the value was missing or unparseable.
 */
export interface KenPomMergedRow {
  teamName: string;
  // Main CSV
  adjOE: number | null;
  adjDE: number | null;
  adjEM: number | null;
  adjTempo: number | null;
  seed: string | null;
  // Offense CSV
  offEfgPct: number | null;
  offToPct: number | null;
  offOrbPct: number | null;
  offFtRate: number | null;
  // Defense CSV
  defEfgPct: number | null;
  defToPct: number | null;
  defOrbPct: number | null;
  defFtRate: number | null;
  // Misc CSV
  offThreePtPct: number | null;
  offFtPct: number | null;
  offThreePtRate: number | null;
  defThreePtPct: number | null;
  defFtPct: number | null;
  defThreePtRate: number | null;
  twoFoulParticipation: number | null;
  // Height CSV
  avgHeight: number | null;
  experience: number | null;
  benchMinutesPct: number | null;
  minutesContinuity: number | null;
}

/**
 * Bundle of raw CSV content strings for the KenPom multi-CSV pipeline.
 * Only main is required; the rest are optional supplementary CSVs.
 */
export interface KenPomCsvBundle {
  main: string;
  offense?: string;
  defense?: string;
  misc?: string;
  height?: string;
}

/**
 * Raw Torvik API response row.
 * Field names match barttorvik.com's data format.
 */
export interface TorvikRawRow {
  team: string;
  conf: string;
  barthag: number;
  adj_o: number;
  adj_d: number;
  adj_t: number;
  efg_o: number;
  efg_d: number;
  to_o: number;
  to_d: number;
  orb_o: number;
  orb_d: number;
  ftr_o: number;
  ftr_d: number;
  "3p_o": number;
  "3p_d": number;
  "3pr_o": number;
  "3pr_d": number;
  ft_o: number;
  ft_d: number;
  [key: string]: string | number; // Allow additional fields
}

/**
 * Row from the Torvik Teams Table CSV export.
 * Column names match the exact headers from barttorvik.com/team-tables_each.php.
 * All values are strings (CSV parser returns strings).
 */
export interface TorvikCsvRow {
  TEAM: string;
  "ADJ OE": string;
  "ADJ DE": string;
  BARTHAG: string;
  RECORD: string;
  WINS: string;
  GAMES: string;
  EFG: string;
  "EFG D.": string;
  "FT RATE": string;
  "FT RATE D": string;
  "TOV%": string;
  "TOV% D": string;
  "O REB%": string;
  "OP REB%": string;
  "OP OREB%": string;
  "RAW T": string;
  "2P %": string;
  "2P % D.": string;
  "3P %": string;
  "3P % D.": string;
  "BLK%": string;
  "BLKED %": string;
  "AST %": string;
  "OP AST %": string;
  "3P RATE": string;
  "3P RATE D": string;
  "ADJ. T": string;
  "AVG HGT.": string;
  "EFF HGT.": string;
  EXP: string;
  YEAR: string;
  PAKE: string;
  PASE: string;
  TALENT: string;
  "FT%": string;
  "OP.FT%": string;
  "PPP OFF.": string;
  "PPP DEF.": string;
  "ELITE SOS": string;
  [key: string]: string; // Allow extra columns
}

/**
 * Raw Evan Miya data row.
 * Field names match expected manual entry or paste format.
 */
export interface EvanMiyaRawRow {
  team: string;
  bpr: string;
  obpr: string;
  dbpr: string;
  [key: string]: string;
}

/**
 * Raw Evan Miya CSV row.
 * Column names match the Evan Miya CSV export format.
 * Extra columns (ranks, colors, tooltips) are ignored via the index signature.
 */
export interface EvanMiyaCsvRow {
  team: string;
  obpr: string;
  dbpr: string;
  bpr: string;
  opponent_adjust: string;
  pace_adjust: string;
  runs_per_game: string;
  runs_conceded_per_game: string;
  runs_margin: string;
  [key: string]: string;
}

// ---------------------------------------------------------------------------
// Import pipeline types
// ---------------------------------------------------------------------------

/** Validation error for a single field */
export interface ValidationError {
  /** Row index in the source data */
  row: number;
  /** Field name that failed validation */
  field: string;
  /** What went wrong */
  message: string;
  /** The invalid value */
  value: unknown;
}

/** Result of validating an import batch */
export interface ValidationResult {
  /** Whether all rows passed validation */
  valid: boolean;
  /** Errors found during validation */
  errors: ValidationError[];
  /** Number of rows successfully validated */
  validRowCount: number;
  /** Total number of rows in the import */
  totalRowCount: number;
}

/** Status of a data import job */
export type ImportStatus =
  | "pending" // Upload received, not yet processed
  | "validating" // Running validation checks
  | "validated" // Validation complete (may have errors)
  | "importing" // Writing to database
  | "complete" // Successfully imported
  | "failed"; // Import failed

/** A data import job record */
export interface ImportJob {
  id: string;
  /** Which data source this import is for */
  source: DataSource;
  /** Which season this data belongs to */
  season: number;
  /** Current status */
  status: ImportStatus;
  /** Validation result (populated after validation) */
  validation?: ValidationResult;
  /** Number of teams imported (populated after completion) */
  teamsImported?: number;
  /** When the import was initiated */
  createdAt: string;
  /** When the import was last updated */
  updatedAt: string;
  /** Error message if import failed */
  error?: string;
}

// ---------------------------------------------------------------------------
// Import request/response types (for API routes)
// ---------------------------------------------------------------------------

/** Request to import CSV data */
export interface CsvImportRequest {
  /** Data source identifier */
  source: DataSource;
  /** Season year */
  season: number;
  /** Raw CSV content as string */
  csvContent: string;
}

/** Request to import Evan Miya data (manual entry) */
export interface ManualImportRequest {
  /** Always "evanmiya" */
  source: "evanmiya";
  /** Season year */
  season: number;
  /** Array of team BPR entries */
  entries: EvanMiyaRawRow[];
}

/** Response from an import operation */
export interface ImportResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** The import job record */
  job: ImportJob;
  /** Human-readable message */
  message: string;
}

// ---------------------------------------------------------------------------
// Team name mapping (handles inconsistent naming across sources)
// ---------------------------------------------------------------------------

/**
 * Maps team names from different sources to a canonical team ID.
 * Team names vary across KenPom, Torvik, and Evan Miya
 * (e.g., "Connecticut" vs "UConn" vs "Connecticut Huskies").
 */
export interface TeamNameMapping {
  /** Canonical team ID in our database */
  teamId: string;
  /** Name as it appears in KenPom exports */
  kenpomName: string;
  /** Name as it appears in Torvik data */
  torvikName: string;
  /** Name as it appears in Evan Miya data */
  evanmiyaName: string;
}
