-- Migration: Add Strength of Schedule and Luck columns to team_seasons
-- Source: KenPom end-of-regular-season data

ALTER TABLE team_seasons
  ADD COLUMN IF NOT EXISTS sos_net_rating DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sos_off_rating DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sos_def_rating DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS luck DOUBLE PRECISION;
