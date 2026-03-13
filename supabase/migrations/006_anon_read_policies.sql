-- ============================================================================
-- 006_anon_read_policies.sql
-- March Madness Bracket Predictor — Public Read Access for Data Tables
--
-- Adds SELECT policies for the `anon` role on team/tournament data tables.
-- This allows public API routes (/api/teams, /api/simulate, /api/backtest)
-- to use the Supabase anon key instead of the service role key, reducing
-- blast radius if a vulnerability is discovered in those routes.
--
-- Previously, these routes used createAdminClient() (service role key) which
-- bypasses all RLS. With these policies, they can use the anon key and RLS
-- will correctly restrict access to read-only on public data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- teams — Allow anonymous read access
-- ---------------------------------------------------------------------------

CREATE POLICY teams_select_anon
  ON teams FOR SELECT
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- coaches — Allow anonymous read access
-- ---------------------------------------------------------------------------

CREATE POLICY coaches_select_anon
  ON coaches FOR SELECT
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- team_seasons — Allow anonymous read access
-- ---------------------------------------------------------------------------

CREATE POLICY team_seasons_select_anon
  ON team_seasons FOR SELECT
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- tournament_entries — Allow anonymous read access
-- ---------------------------------------------------------------------------

CREATE POLICY tournament_entries_select_anon
  ON tournament_entries FOR SELECT
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- tournament_sites — Allow anonymous read access
-- ---------------------------------------------------------------------------

CREATE POLICY tournament_sites_select_anon
  ON tournament_sites FOR SELECT
  TO anon
  USING (true);
