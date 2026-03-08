-- Migration: 003_user_tables.sql
-- Creates tables for user-owned data: brackets, lever configs, settings.
-- Includes RLS policies scoped to auth.uid() = user_id.

-- =================================================================
-- Table: user_brackets
-- Stores user bracket picks and simulation snapshots.
-- =================================================================

CREATE TABLE IF NOT EXISTS user_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Bracket',
  season INTEGER NOT NULL DEFAULT 2026,
  picks JSONB NOT NULL DEFAULT '{}',
  simulation_snapshot JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_brackets_user_season ON user_brackets(user_id, season);

-- =================================================================
-- Table: user_lever_configs
-- Stores saved lever configurations (global + matchup overrides).
-- =================================================================

CREATE TABLE IF NOT EXISTS user_lever_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Config',
  season INTEGER NOT NULL DEFAULT 2026,
  global_levers JSONB NOT NULL DEFAULT '{}',
  matchup_overrides JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_lever_configs_user_season ON user_lever_configs(user_id, season);

-- =================================================================
-- Table: user_settings
-- Stores per-user preferences (pool size, simulation count, etc.).
-- One row per user (UNIQUE constraint on user_id).
-- =================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pool_size_bucket TEXT NOT NULL DEFAULT 'medium',
  simulation_count INTEGER NOT NULL DEFAULT 10000,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- Triggers: auto-update updated_at
-- =================================================================

-- Reuse the trigger function from 001 if it exists, otherwise create it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_user_brackets
  BEFORE UPDATE ON user_brackets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_user_lever_configs
  BEFORE UPDATE ON user_lever_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- RLS Policies
-- =================================================================

ALTER TABLE user_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lever_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- user_brackets: users can CRUD their own rows, admins can access all
CREATE POLICY "Users can select own brackets"
  ON user_brackets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brackets"
  ON user_brackets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brackets"
  ON user_brackets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own brackets"
  ON user_brackets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all brackets"
  ON user_brackets FOR ALL TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role') = 'admin'
  );

-- user_lever_configs: same pattern
CREATE POLICY "Users can select own lever configs"
  ON user_lever_configs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lever configs"
  ON user_lever_configs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lever configs"
  ON user_lever_configs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lever configs"
  ON user_lever_configs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all lever configs"
  ON user_lever_configs FOR ALL TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role') = 'admin'
  );

-- user_settings: same pattern
CREATE POLICY "Users can select own settings"
  ON user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all settings"
  ON user_settings FOR ALL TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role') = 'admin'
  );
