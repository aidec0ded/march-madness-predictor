/**
 * Supabase client and helpers.
 *
 * Re-exports all public APIs:
 * - Client factories (browser, server, middleware, and admin)
 * - Database type definitions
 */

// Client factories
export {
  createBrowserClient,
  createServerClient,
  createMiddlewareClient,
  createAdminClient,
} from "./client";

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
  UserBracketRow,
  UserBracketInsert,
  UserBracketUpdate,
  UserLeverConfigRow,
  UserLeverConfigInsert,
  UserLeverConfigUpdate,
  UserSettingsRow,
  UserSettingsInsert,
  UserSettingsUpdate,
} from "./types";
