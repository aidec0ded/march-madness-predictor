/**
 * Supabase database type definitions for the March Madness Bracket Predictor.
 *
 * These types mirror the SQL schema defined in `supabase/migrations/001_initial_schema.sql`
 * and follow the Supabase-generated types pattern with Row, Insert, and Update
 * variants for each table.
 *
 * - Row: The full shape returned by SELECT queries (all fields present).
 * - Insert: The shape accepted by INSERT queries (auto-generated fields optional).
 * - Update: The shape accepted by UPDATE queries (all fields optional).
 */

// ---------------------------------------------------------------------------
// Custom enum types (matching SQL enums)
// ---------------------------------------------------------------------------

export type DbDataSource = "kenpom" | "torvik" | "evanmiya";

export type DbTournamentRegion = "East" | "West" | "South" | "Midwest";

export type DbTournamentRound = "FF" | "R64" | "R32" | "S16" | "E8" | "F4" | "NCG";

export type DbImportStatus =
  | "pending"
  | "validating"
  | "validated"
  | "importing"
  | "complete"
  | "failed";

// ---------------------------------------------------------------------------
// Database schema definition
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      // ----- teams -----
      teams: {
        Row: {
          id: string;
          name: string;
          short_name: string;
          conference: string;
          campus_city: string;
          campus_state: string;
          campus_lat: number;
          campus_lng: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name: string;
          conference: string;
          campus_city: string;
          campus_state: string;
          campus_lat: number;
          campus_lng: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          short_name?: string;
          conference?: string;
          campus_city?: string;
          campus_state?: string;
          campus_lat?: number;
          campus_lng?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- coaches -----
      coaches: {
        Row: {
          id: string;
          name: string;
          tournament_games: number;
          tournament_wins: number;
          final_fours: number;
          championships: number;
          years_head_coach: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tournament_games?: number;
          tournament_wins?: number;
          final_fours?: number;
          championships?: number;
          years_head_coach?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          tournament_games?: number;
          tournament_wins?: number;
          final_fours?: number;
          championships?: number;
          years_head_coach?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- team_seasons -----
      team_seasons: {
        Row: {
          id: string;
          team_id: string;
          season: number;
          coach_id: string | null;

          // Efficiency ratings: KenPom
          kenpom_adj_oe: number | null;
          kenpom_adj_de: number | null;
          kenpom_adj_em: number | null;

          // Efficiency ratings: Torvik
          torvik_adj_oe: number | null;
          torvik_adj_de: number | null;
          torvik_adj_em: number | null;

          // Efficiency ratings: Evan Miya
          evanmiya_adj_oe: number | null;
          evanmiya_adj_de: number | null;
          evanmiya_adj_em: number | null;

          // Four Factors: Offense
          off_efg_pct: number | null;
          off_to_pct: number | null;
          off_orb_pct: number | null;
          off_ft_rate: number | null;

          // Four Factors: Defense
          def_efg_pct: number | null;
          def_to_pct: number | null;
          def_orb_pct: number | null;
          def_ft_rate: number | null;

          // Shooting splits: Offense
          off_three_pt_pct: number | null;
          off_three_pt_rate: number | null;
          off_ft_pct: number | null;

          // Shooting splits: Defense
          def_three_pt_pct: number | null;
          def_three_pt_rate: number | null;
          def_ft_pct: number | null;

          // Tempo & Pace
          adj_tempo: number | null;
          avg_poss_length_off: number | null;
          avg_poss_length_def: number | null;

          // Roster & Experience
          bench_minutes_pct: number | null;
          experience: number | null;
          minutes_continuity: number | null;
          avg_height: number | null;

          // Style
          two_foul_participation: number | null;

          // Evan Miya-specific metrics
          evanmiya_opponent_adjust: number | null;
          evanmiya_pace_adjust: number | null;
          evanmiya_kill_shots_per_game: number | null;
          evanmiya_kill_shots_allowed_per_game: number | null;
          evanmiya_kill_shots_margin: number | null;

          // Strength of Schedule & Luck (KenPom)
          sos_net_rating: number | null;
          sos_off_rating: number | null;
          sos_def_rating: number | null;
          luck: number | null;

          // Metadata
          data_sources: DbDataSource[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          season: number;
          coach_id?: string | null;

          kenpom_adj_oe?: number | null;
          kenpom_adj_de?: number | null;
          kenpom_adj_em?: number | null;

          torvik_adj_oe?: number | null;
          torvik_adj_de?: number | null;
          torvik_adj_em?: number | null;

          evanmiya_adj_oe?: number | null;
          evanmiya_adj_de?: number | null;
          evanmiya_adj_em?: number | null;

          off_efg_pct?: number | null;
          off_to_pct?: number | null;
          off_orb_pct?: number | null;
          off_ft_rate?: number | null;

          def_efg_pct?: number | null;
          def_to_pct?: number | null;
          def_orb_pct?: number | null;
          def_ft_rate?: number | null;

          off_three_pt_pct?: number | null;
          off_three_pt_rate?: number | null;
          off_ft_pct?: number | null;

          def_three_pt_pct?: number | null;
          def_three_pt_rate?: number | null;
          def_ft_pct?: number | null;

          adj_tempo?: number | null;
          avg_poss_length_off?: number | null;
          avg_poss_length_def?: number | null;

          bench_minutes_pct?: number | null;
          experience?: number | null;
          minutes_continuity?: number | null;
          avg_height?: number | null;

          two_foul_participation?: number | null;

          evanmiya_opponent_adjust?: number | null;
          evanmiya_pace_adjust?: number | null;
          evanmiya_kill_shots_per_game?: number | null;
          evanmiya_kill_shots_allowed_per_game?: number | null;
          evanmiya_kill_shots_margin?: number | null;

          sos_net_rating?: number | null;
          sos_off_rating?: number | null;
          sos_def_rating?: number | null;
          luck?: number | null;

          data_sources?: DbDataSource[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          season?: number;
          coach_id?: string | null;

          kenpom_adj_oe?: number | null;
          kenpom_adj_de?: number | null;
          kenpom_adj_em?: number | null;

          torvik_adj_oe?: number | null;
          torvik_adj_de?: number | null;
          torvik_adj_em?: number | null;

          evanmiya_adj_oe?: number | null;
          evanmiya_adj_de?: number | null;
          evanmiya_adj_em?: number | null;

          off_efg_pct?: number | null;
          off_to_pct?: number | null;
          off_orb_pct?: number | null;
          off_ft_rate?: number | null;

          def_efg_pct?: number | null;
          def_to_pct?: number | null;
          def_orb_pct?: number | null;
          def_ft_rate?: number | null;

          off_three_pt_pct?: number | null;
          off_three_pt_rate?: number | null;
          off_ft_pct?: number | null;

          def_three_pt_pct?: number | null;
          def_three_pt_rate?: number | null;
          def_ft_pct?: number | null;

          adj_tempo?: number | null;
          avg_poss_length_off?: number | null;
          avg_poss_length_def?: number | null;

          bench_minutes_pct?: number | null;
          experience?: number | null;
          minutes_continuity?: number | null;
          avg_height?: number | null;

          two_foul_participation?: number | null;

          evanmiya_opponent_adjust?: number | null;
          evanmiya_pace_adjust?: number | null;
          evanmiya_kill_shots_per_game?: number | null;
          evanmiya_kill_shots_allowed_per_game?: number | null;
          evanmiya_kill_shots_margin?: number | null;

          sos_net_rating?: number | null;
          sos_off_rating?: number | null;
          sos_def_rating?: number | null;
          luck?: number | null;

          data_sources?: DbDataSource[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- tournament_entries -----
      tournament_entries: {
        Row: {
          id: string;
          team_season_id: string;
          team_id: string;
          season: number;
          seed: number;
          region: DbTournamentRegion;
          bracket_position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_season_id: string;
          team_id: string;
          season: number;
          seed: number;
          region: DbTournamentRegion;
          bracket_position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_season_id?: string;
          team_id?: string;
          season?: number;
          seed?: number;
          region?: DbTournamentRegion;
          bracket_position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- tournament_sites -----
      tournament_sites: {
        Row: {
          id: string;
          name: string;
          city: string;
          state: string;
          latitude: number;
          longitude: number;
          rounds: DbTournamentRound[];
          regions: DbTournamentRegion[] | null;
          /** Which seed lines play at this venue (e.g. [1,16,8,9] for a R64 pod). NULL = all games. */
          seed_matchups: number[] | null;
          season: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          state: string;
          latitude: number;
          longitude: number;
          rounds: DbTournamentRound[];
          regions?: DbTournamentRegion[] | null;
          seed_matchups?: number[] | null;
          season: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string;
          state?: string;
          latitude?: number;
          longitude?: number;
          rounds?: DbTournamentRound[];
          regions?: DbTournamentRegion[] | null;
          seed_matchups?: number[] | null;
          season?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      // ----- team_name_mappings -----
      team_name_mappings: {
        Row: {
          id: string;
          team_id: string;
          kenpom_name: string;
          torvik_name: string;
          evanmiya_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          kenpom_name: string;
          torvik_name: string;
          evanmiya_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          kenpom_name?: string;
          torvik_name?: string;
          evanmiya_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- import_jobs -----
      import_jobs: {
        Row: {
          id: string;
          source: DbDataSource;
          season: number;
          status: DbImportStatus;
          validation: Record<string, unknown> | null;
          teams_imported: number | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source: DbDataSource;
          season: number;
          status?: DbImportStatus;
          validation?: Record<string, unknown> | null;
          teams_imported?: number | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source?: DbDataSource;
          season?: number;
          status?: DbImportStatus;
          validation?: Record<string, unknown> | null;
          teams_imported?: number | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- user_brackets -----
      user_brackets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          season: number;
          picks: Record<string, unknown>;
          global_levers: Record<string, unknown>;
          matchup_overrides: Record<string, unknown>;
          simulation_snapshot: Record<string, unknown> | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          season?: number;
          picks?: Record<string, unknown>;
          global_levers?: Record<string, unknown>;
          matchup_overrides?: Record<string, unknown>;
          simulation_snapshot?: Record<string, unknown> | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          season?: number;
          picks?: Record<string, unknown>;
          global_levers?: Record<string, unknown>;
          matchup_overrides?: Record<string, unknown>;
          simulation_snapshot?: Record<string, unknown> | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- user_lever_configs -----
      user_lever_configs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          season: number;
          global_levers: Record<string, unknown>;
          matchup_overrides: Record<string, unknown>;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          season?: number;
          global_levers?: Record<string, unknown>;
          matchup_overrides?: Record<string, unknown>;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          season?: number;
          global_levers?: Record<string, unknown>;
          matchup_overrides?: Record<string, unknown>;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----- user_settings -----
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          pool_size_bucket: string;
          simulation_count: number;
          preferences: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pool_size_bucket?: string;
          simulation_count?: number;
          preferences?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pool_size_bucket?: string;
          simulation_count?: number;
          preferences?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      data_source: DbDataSource;
      tournament_region: DbTournamentRegion;
      tournament_round: DbTournamentRound;
      import_status: DbImportStatus;
    };
  };
}

// ---------------------------------------------------------------------------
// Convenience type aliases
// ---------------------------------------------------------------------------

/** Shorthand for a teams table row. */
export type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
export type TeamInsert = Database["public"]["Tables"]["teams"]["Insert"];
export type TeamUpdate = Database["public"]["Tables"]["teams"]["Update"];

/** Shorthand for a coaches table row. */
export type CoachRow = Database["public"]["Tables"]["coaches"]["Row"];
export type CoachInsert = Database["public"]["Tables"]["coaches"]["Insert"];
export type CoachUpdate = Database["public"]["Tables"]["coaches"]["Update"];

/** Shorthand for a team_seasons table row. */
export type TeamSeasonRow = Database["public"]["Tables"]["team_seasons"]["Row"];
export type TeamSeasonInsert =
  Database["public"]["Tables"]["team_seasons"]["Insert"];
export type TeamSeasonUpdate =
  Database["public"]["Tables"]["team_seasons"]["Update"];

/** Shorthand for a tournament_entries table row. */
export type TournamentEntryRow =
  Database["public"]["Tables"]["tournament_entries"]["Row"];
export type TournamentEntryInsert =
  Database["public"]["Tables"]["tournament_entries"]["Insert"];
export type TournamentEntryUpdate =
  Database["public"]["Tables"]["tournament_entries"]["Update"];

/** Shorthand for a tournament_sites table row. */
export type TournamentSiteRow =
  Database["public"]["Tables"]["tournament_sites"]["Row"];
export type TournamentSiteInsert =
  Database["public"]["Tables"]["tournament_sites"]["Insert"];
export type TournamentSiteUpdate =
  Database["public"]["Tables"]["tournament_sites"]["Update"];

/** Shorthand for a team_name_mappings table row. */
export type TeamNameMappingRow =
  Database["public"]["Tables"]["team_name_mappings"]["Row"];
export type TeamNameMappingInsert =
  Database["public"]["Tables"]["team_name_mappings"]["Insert"];
export type TeamNameMappingUpdate =
  Database["public"]["Tables"]["team_name_mappings"]["Update"];

/** Shorthand for an import_jobs table row. */
export type ImportJobRow = Database["public"]["Tables"]["import_jobs"]["Row"];
export type ImportJobInsert =
  Database["public"]["Tables"]["import_jobs"]["Insert"];
export type ImportJobUpdate =
  Database["public"]["Tables"]["import_jobs"]["Update"];

/** Shorthand for a user_brackets table row. */
export type UserBracketRow =
  Database["public"]["Tables"]["user_brackets"]["Row"];
export type UserBracketInsert =
  Database["public"]["Tables"]["user_brackets"]["Insert"];
export type UserBracketUpdate =
  Database["public"]["Tables"]["user_brackets"]["Update"];

/** Shorthand for a user_lever_configs table row. */
export type UserLeverConfigRow =
  Database["public"]["Tables"]["user_lever_configs"]["Row"];
export type UserLeverConfigInsert =
  Database["public"]["Tables"]["user_lever_configs"]["Insert"];
export type UserLeverConfigUpdate =
  Database["public"]["Tables"]["user_lever_configs"]["Update"];

/** Shorthand for a user_settings table row. */
export type UserSettingsRow =
  Database["public"]["Tables"]["user_settings"]["Row"];
export type UserSettingsInsert =
  Database["public"]["Tables"]["user_settings"]["Insert"];
export type UserSettingsUpdate =
  Database["public"]["Tables"]["user_settings"]["Update"];
