-- ============================================================================
-- 001_initial_schema.sql
-- March Madness Bracket Predictor — Initial Database Schema
--
-- Creates all core tables for team data, season statistics, tournament
-- entries, import tracking, and name mappings across data sources.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Custom types
-- ---------------------------------------------------------------------------

CREATE TYPE data_source AS ENUM ('kenpom', 'torvik', 'evanmiya');

CREATE TYPE tournament_region AS ENUM ('East', 'West', 'South', 'Midwest');

CREATE TYPE tournament_round AS ENUM ('R64', 'R32', 'S16', 'E8', 'F4', 'NCG');

CREATE TYPE import_status AS ENUM (
  'pending',
  'validating',
  'validated',
  'importing',
  'complete',
  'failed'
);

-- ---------------------------------------------------------------------------
-- 1. teams — Core team identity, stable across seasons
-- ---------------------------------------------------------------------------

CREATE TABLE teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,                -- e.g. "Connecticut Huskies"
  short_name    TEXT NOT NULL,                -- e.g. "UConn"
  conference    TEXT NOT NULL,                -- current conference
  campus_city   TEXT NOT NULL,
  campus_state  TEXT NOT NULL,
  campus_lat    DOUBLE PRECISION NOT NULL,    -- latitude
  campus_lng    DOUBLE PRECISION NOT NULL,    -- longitude
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT teams_name_unique UNIQUE (name),
  CONSTRAINT teams_short_name_unique UNIQUE (short_name),
  CONSTRAINT teams_lat_range CHECK (campus_lat BETWEEN -90 AND 90),
  CONSTRAINT teams_lng_range CHECK (campus_lng BETWEEN -180 AND 180)
);

CREATE INDEX idx_teams_conference ON teams (conference);

-- ---------------------------------------------------------------------------
-- 2. coaches — Coach records and tournament history
-- ---------------------------------------------------------------------------

CREATE TABLE coaches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  tournament_games  INTEGER NOT NULL DEFAULT 0,
  tournament_wins   INTEGER NOT NULL DEFAULT 0,
  final_fours       INTEGER NOT NULL DEFAULT 0,
  championships     INTEGER NOT NULL DEFAULT 0,
  years_head_coach  INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT coaches_name_unique UNIQUE (name),
  CONSTRAINT coaches_wins_lte_games CHECK (tournament_wins <= tournament_games),
  CONSTRAINT coaches_non_negative CHECK (
    tournament_games >= 0
    AND tournament_wins >= 0
    AND final_fours >= 0
    AND championships >= 0
    AND years_head_coach >= 0
  )
);

-- ---------------------------------------------------------------------------
-- 3. team_seasons — One row per team per season with ALL statistical fields
-- ---------------------------------------------------------------------------

CREATE TABLE team_seasons (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id               UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season                INTEGER NOT NULL,           -- e.g. 2025 for 2024-25
  coach_id              UUID REFERENCES coaches(id) ON DELETE SET NULL,

  -- === Efficiency ratings: KenPom ===
  kenpom_adj_oe         DOUBLE PRECISION,           -- Adjusted Offensive Efficiency
  kenpom_adj_de         DOUBLE PRECISION,           -- Adjusted Defensive Efficiency
  kenpom_adj_em         DOUBLE PRECISION,           -- Adjusted Efficiency Margin

  -- === Efficiency ratings: Torvik ===
  torvik_adj_oe         DOUBLE PRECISION,
  torvik_adj_de         DOUBLE PRECISION,
  torvik_adj_em         DOUBLE PRECISION,

  -- === Efficiency ratings: Evan Miya ===
  evanmiya_adj_oe       DOUBLE PRECISION,           -- OBPR
  evanmiya_adj_de       DOUBLE PRECISION,           -- DBPR
  evanmiya_adj_em       DOUBLE PRECISION,           -- BPR

  -- === Four Factors: Offense ===
  off_efg_pct           DOUBLE PRECISION,           -- Effective FG%
  off_to_pct            DOUBLE PRECISION,           -- Turnover Rate
  off_orb_pct           DOUBLE PRECISION,           -- Offensive Rebound %
  off_ft_rate           DOUBLE PRECISION,           -- Free Throw Rate (FTA/FGA)

  -- === Four Factors: Defense ===
  def_efg_pct           DOUBLE PRECISION,           -- Opponent Effective FG%
  def_to_pct            DOUBLE PRECISION,           -- Opponent Turnover Rate
  def_orb_pct           DOUBLE PRECISION,           -- Opponent Offensive Rebound %
  def_ft_rate           DOUBLE PRECISION,           -- Opponent Free Throw Rate

  -- === Shooting splits: Offense ===
  off_three_pt_pct      DOUBLE PRECISION,           -- 3P%
  off_three_pt_rate     DOUBLE PRECISION,           -- 3PA/FGA
  off_ft_pct            DOUBLE PRECISION,           -- FT%

  -- === Shooting splits: Defense ===
  def_three_pt_pct      DOUBLE PRECISION,           -- Opponent 3P%
  def_three_pt_rate     DOUBLE PRECISION,           -- Opponent 3PA/FGA
  def_ft_pct            DOUBLE PRECISION,           -- Opponent FT%

  -- === Tempo & Pace ===
  adj_tempo             DOUBLE PRECISION,           -- Possessions per 40 min (adj.)
  avg_poss_length_off   DOUBLE PRECISION,           -- Avg offensive possession (sec)
  avg_poss_length_def   DOUBLE PRECISION,           -- Avg defensive possession (sec)

  -- === Roster & Experience ===
  bench_minutes_pct     DOUBLE PRECISION,           -- Non-starter minutes share
  experience            DOUBLE PRECISION,           -- Minutes-weighted D-1 experience
  minutes_continuity    DOUBLE PRECISION,           -- Returning minutes %
  avg_height            DOUBLE PRECISION,           -- Average height (inches)

  -- === Style ===
  two_foul_participation DOUBLE PRECISION,          -- 2-foul participation rate

  -- === Metadata ===
  data_sources          data_source[] NOT NULL DEFAULT '{}', -- Which sources loaded
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- === Constraints ===
  CONSTRAINT team_seasons_unique UNIQUE (team_id, season),
  CONSTRAINT team_seasons_season_range CHECK (season BETWEEN 2000 AND 2100)
);

-- Primary lookup: team + season
CREATE INDEX idx_team_seasons_team_season ON team_seasons (team_id, season);

-- Season-wide queries (e.g., "all teams in 2025")
CREATE INDEX idx_team_seasons_season ON team_seasons (season);

-- Coach lookups
CREATE INDEX idx_team_seasons_coach ON team_seasons (coach_id);

-- Filter by which data sources have been loaded
CREATE INDEX idx_team_seasons_data_sources ON team_seasons USING GIN (data_sources);

-- ---------------------------------------------------------------------------
-- 4. tournament_entries — Seed, region, bracket position per team per season
-- ---------------------------------------------------------------------------

CREATE TABLE tournament_entries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_season_id    UUID NOT NULL REFERENCES team_seasons(id) ON DELETE CASCADE,
  team_id           UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season            INTEGER NOT NULL,
  seed              SMALLINT NOT NULL,
  region            tournament_region NOT NULL,
  bracket_position  SMALLINT NOT NULL,           -- 1-16 within region
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tournament_entries_unique UNIQUE (team_id, season),
  CONSTRAINT tournament_entries_seed_range CHECK (seed BETWEEN 1 AND 16),
  CONSTRAINT tournament_entries_position_range CHECK (bracket_position BETWEEN 1 AND 16)
);

CREATE INDEX idx_tournament_entries_season ON tournament_entries (season);
CREATE INDEX idx_tournament_entries_region ON tournament_entries (season, region);
CREATE INDEX idx_tournament_entries_team_season ON tournament_entries (team_season_id);

-- ---------------------------------------------------------------------------
-- 5. tournament_sites — Venue info for site proximity calculations
-- ---------------------------------------------------------------------------

CREATE TABLE tournament_sites (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name      TEXT NOT NULL,                    -- e.g. "State Farm Arena"
  city      TEXT NOT NULL,
  state     TEXT NOT NULL,
  latitude  DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  rounds    tournament_round[] NOT NULL,      -- Which rounds played here
  regions   tournament_region[],              -- Which regions play here (regionals)
  season    INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tournament_sites_lat_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT tournament_sites_lng_range CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT tournament_sites_unique UNIQUE (name, season)
);

CREATE INDEX idx_tournament_sites_season ON tournament_sites (season);
CREATE INDEX idx_tournament_sites_rounds ON tournament_sites USING GIN (rounds);

-- ---------------------------------------------------------------------------
-- 6. team_name_mappings — Source-specific names to canonical team IDs
-- ---------------------------------------------------------------------------

CREATE TABLE team_name_mappings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kenpom_name    TEXT NOT NULL,                -- Name in KenPom exports
  torvik_name    TEXT NOT NULL,                -- Name in Torvik data
  evanmiya_name  TEXT NOT NULL,                -- Name in Evan Miya data
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT team_name_mappings_team_unique UNIQUE (team_id),
  CONSTRAINT team_name_mappings_kenpom_unique UNIQUE (kenpom_name),
  CONSTRAINT team_name_mappings_torvik_unique UNIQUE (torvik_name),
  CONSTRAINT team_name_mappings_evanmiya_unique UNIQUE (evanmiya_name)
);

CREATE INDEX idx_team_name_mappings_kenpom ON team_name_mappings (kenpom_name);
CREATE INDEX idx_team_name_mappings_torvik ON team_name_mappings (torvik_name);
CREATE INDEX idx_team_name_mappings_evanmiya ON team_name_mappings (evanmiya_name);

-- ---------------------------------------------------------------------------
-- 7. import_jobs — Tracks data import status and validation results
-- ---------------------------------------------------------------------------

CREATE TABLE import_jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source           data_source NOT NULL,
  season           INTEGER NOT NULL,
  status           import_status NOT NULL DEFAULT 'pending',
  validation       JSONB,                       -- ValidationResult as JSON
  teams_imported   INTEGER,
  error            TEXT,                         -- Error message if failed
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT import_jobs_season_range CHECK (season BETWEEN 2000 AND 2100),
  CONSTRAINT import_jobs_teams_imported_non_negative CHECK (
    teams_imported IS NULL OR teams_imported >= 0
  )
);

CREATE INDEX idx_import_jobs_source_season ON import_jobs (source, season);
CREATE INDEX idx_import_jobs_status ON import_jobs (status);
CREATE INDEX idx_import_jobs_created ON import_jobs (created_at DESC);

-- ---------------------------------------------------------------------------
-- Trigger function: auto-update updated_at on row modification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables with that column
CREATE TRIGGER trg_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_coaches_updated_at
  BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_team_seasons_updated_at
  BEFORE UPDATE ON team_seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tournament_entries_updated_at
  BEFORE UPDATE ON tournament_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_team_name_mappings_updated_at
  BEFORE UPDATE ON team_name_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
