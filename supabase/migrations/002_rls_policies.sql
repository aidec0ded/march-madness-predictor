-- ============================================================================
-- 002_rls_policies.sql
-- March Madness Bracket Predictor — Row Level Security Policies
--
-- Security model:
--   - Admin role: full read/write on all tables
--   - Authenticated users: read-only on team data tables
--   - Import jobs: admin-only (no authenticated user access)
--
-- Admin detection uses a custom claim stored in auth.users.raw_app_meta_data:
--   { "role": "admin" }
-- Set this via Supabase dashboard or a migration on the auth.users table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper function: check if the current user is an admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb
        -> 'app_metadata'
        ->> 'role',
      ''
    ) = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------

ALTER TABLE teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_seasons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_sites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_name_mappings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs          ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- teams — Authenticated read, admin write
-- ---------------------------------------------------------------------------

CREATE POLICY teams_select_authenticated
  ON teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY teams_insert_admin
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY teams_update_admin
  ON teams FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY teams_delete_admin
  ON teams FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- coaches — Authenticated read, admin write
-- ---------------------------------------------------------------------------

CREATE POLICY coaches_select_authenticated
  ON coaches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY coaches_insert_admin
  ON coaches FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY coaches_update_admin
  ON coaches FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY coaches_delete_admin
  ON coaches FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- team_seasons — Authenticated read, admin write
-- ---------------------------------------------------------------------------

CREATE POLICY team_seasons_select_authenticated
  ON team_seasons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY team_seasons_insert_admin
  ON team_seasons FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY team_seasons_update_admin
  ON team_seasons FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY team_seasons_delete_admin
  ON team_seasons FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- tournament_entries — Authenticated read, admin write
-- ---------------------------------------------------------------------------

CREATE POLICY tournament_entries_select_authenticated
  ON tournament_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY tournament_entries_insert_admin
  ON tournament_entries FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY tournament_entries_update_admin
  ON tournament_entries FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY tournament_entries_delete_admin
  ON tournament_entries FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- tournament_sites — Authenticated read, admin write
-- ---------------------------------------------------------------------------

CREATE POLICY tournament_sites_select_authenticated
  ON tournament_sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY tournament_sites_insert_admin
  ON tournament_sites FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY tournament_sites_update_admin
  ON tournament_sites FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY tournament_sites_delete_admin
  ON tournament_sites FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- team_name_mappings — Authenticated read, admin write
-- ---------------------------------------------------------------------------

CREATE POLICY team_name_mappings_select_authenticated
  ON team_name_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY team_name_mappings_insert_admin
  ON team_name_mappings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY team_name_mappings_update_admin
  ON team_name_mappings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY team_name_mappings_delete_admin
  ON team_name_mappings FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- import_jobs — Admin only (no authenticated user access)
-- ---------------------------------------------------------------------------

CREATE POLICY import_jobs_select_admin
  ON import_jobs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY import_jobs_insert_admin
  ON import_jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY import_jobs_update_admin
  ON import_jobs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY import_jobs_delete_admin
  ON import_jobs FOR DELETE
  TO authenticated
  USING (is_admin());
