/**
 * Central type exports for the March Madness Bracket Predictor.
 */

// Team data model
export type {
  Conference,
  Seed,
  Region,
  DataSource,
  TournamentRound,
  FourFactors,
  ShootingSplits,
  EfficiencyRatings,
  Team,
  CoachRecord,
  TournamentEntry,
  TeamSeason,
  TournamentSite,
  SiteProximityBucket,
} from "./team";

// Data import pipeline types
export type {
  KenPomRawRow,
  TorvikRawRow,
  EvanMiyaRawRow,
  ValidationError,
  ValidationResult,
  ImportStatus,
  ImportJob,
  CsvImportRequest,
  ManualImportRequest,
  ImportResponse,
  TeamNameMapping,
} from "./data-import";

// Engine types (probability model, levers, matchup)
export type {
  CompositeWeights,
  FourFactorsLeverWeights,
  GlobalLevers,
  MatchupOverrides,
  MatchupInput,
  ProbabilityBreakdown,
  MatchupResult,
  EngineConfig,
} from "./engine";

export {
  DEFAULT_COMPOSITE_WEIGHTS,
  DEFAULT_FOUR_FACTORS_WEIGHTS,
  DEFAULT_GLOBAL_LEVERS,
  DEFAULT_ENGINE_CONFIG,
  SITE_PROXIMITY_ADJUSTMENTS,
  SITE_PROXIMITY_THRESHOLDS,
} from "./engine";
