-- ============================================================================
-- 004_evanmiya_columns.sql
-- Add Evan Miya-specific metrics to team_seasons
--
-- These columns store metrics unique to Evan Miya's BPR system that are not
-- available from KenPom or Torvik:
--   - Opponent Adjustment: how well a team plays up/down to competition
--   - Pace Adjustment: how well a team performs in fast vs slow games
--   - Kill Shots: 10-0 scoring runs per game (made and allowed)
-- ============================================================================

ALTER TABLE team_seasons
  ADD COLUMN IF NOT EXISTS evanmiya_opponent_adjust               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS evanmiya_pace_adjust                   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS evanmiya_kill_shots_per_game           DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS evanmiya_kill_shots_allowed_per_game   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS evanmiya_kill_shots_margin             DOUBLE PRECISION;

COMMENT ON COLUMN team_seasons.evanmiya_opponent_adjust IS 'Evan Miya: performance vs strong/weak opponents (positive = plays UP to competition)';
COMMENT ON COLUMN team_seasons.evanmiya_pace_adjust IS 'Evan Miya: performance in fast vs slow games (positive = better in fast-paced games)';
COMMENT ON COLUMN team_seasons.evanmiya_kill_shots_per_game IS 'Evan Miya: 10-0 scoring runs made per game';
COMMENT ON COLUMN team_seasons.evanmiya_kill_shots_allowed_per_game IS 'Evan Miya: 10-0 scoring runs allowed per game';
COMMENT ON COLUMN team_seasons.evanmiya_kill_shots_margin IS 'Evan Miya: kill shots margin per game (made - allowed)';
