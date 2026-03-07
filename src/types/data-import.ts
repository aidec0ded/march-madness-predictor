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
 * Raw KenPom CSV row.
 * Field names match KenPom's export format.
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
