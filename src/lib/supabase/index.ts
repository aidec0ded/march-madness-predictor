/**
 * Supabase client and helpers.
 *
 * Re-exports all public APIs:
 * - Client factories (browser and server)
 * - Database type definitions
 */

// Client factories
export { createBrowserClient, createServerClient } from "./client";

// Database types
export type {
  Database,
  DbDataSource,
  DbTournamentRegion,
  DbTournamentRound,
  DbImportStatus,
  TeamRow,
  TeamInsert,
  TeamUpdate,
  CoachRow,
  CoachInsert,
  CoachUpdate,
  TeamSeasonRow,
  TeamSeasonInsert,
  TeamSeasonUpdate,
  TournamentEntryRow,
  TournamentEntryInsert,
  TournamentEntryUpdate,
  TournamentSiteRow,
  TournamentSiteInsert,
  TournamentSiteUpdate,
  TeamNameMappingRow,
  TeamNameMappingInsert,
  TeamNameMappingUpdate,
  ImportJobRow,
  ImportJobInsert,
  ImportJobUpdate,
} from "./types";
