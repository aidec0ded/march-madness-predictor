-- Migration 007: Add global_levers and matchup_overrides columns to user_brackets
--
-- Previously, lever configurations were only stored in user_lever_configs (a
-- separate table). This meant that when a bracket was saved and reloaded,
-- lever tuning was lost — globalLevers was reset to defaults and matchup
-- overrides were emptied.
--
-- This migration embeds lever state directly in user_brackets so each bracket
-- snapshot captures the full state: picks + levers + overrides + simulation.

ALTER TABLE user_brackets
  ADD COLUMN IF NOT EXISTS global_levers JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS matchup_overrides JSONB NOT NULL DEFAULT '{}';

-- Add a comment explaining the JSONB structure
COMMENT ON COLUMN user_brackets.global_levers IS
  'GlobalLevers object — composite weights, four factors weights, and scalar lever weights. Empty object ({}) means use application defaults.';

COMMENT ON COLUMN user_brackets.matchup_overrides IS
  'Per-matchup overrides keyed by gameId. Each value is a MatchupOverrides object with injury/form/rest adjustments and optional lever overrides.';
