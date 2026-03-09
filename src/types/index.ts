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
  KenPomMainCsvRow,
  KenPomOffenseCsvRow,
  KenPomDefenseCsvRow,
  KenPomMiscCsvRow,
  KenPomHeightCsvRow,
  KenPomMergedRow,
  KenPomCsvBundle,
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

// Simulation types (Monte Carlo)
export type {
  BracketSlot,
  BracketMatchup,
  SimulationConfig,
  SimulationCount,
  TeamSimulationResult,
  SimulatedBracket,
  SimulationResult,
  SimulationRequest,
  SimulationResponse,
} from "./simulation";

export { SIMULATION_COUNT_OPTIONS } from "./simulation";

// User data types
export type {
  PoolSizeBucket,
  UserBracket,
  UserLeverConfig,
  UserSettings,
} from "./user";

export { POOL_SIZE_LABELS } from "./user";

// Guidance types (Phase 8)
export type {
  GuidanceSeverity,
  GuidanceCategory,
  GuidanceMessage,
  GuidanceContext,
  GuidanceRule,
} from "./guidance";

// Narrative types (Phase 9 — AI matchup analysis)
export type {
  NarrativeRequest,
  NarrativeTeamData,
  NarrativeStatus,
  NarrativeState,
  NarrativeCacheEntry,
} from "./narrative";

// Backtest types (Phase 10 — backtesting module)
export type {
  HistoricalGameResult,
  TournamentResults,
  BrierGameScore,
  BrierScoreResult,
  BacktestYearResult,
  BacktestResult,
  CalibrationBin,
  BacktestRequest,
  BacktestResponse,
} from "./backtest";

export {
  TRAIN_SEASONS,
  TEST_SEASONS,
  ALL_SEASONS,
  ANOMALOUS_SEASONS,
  SEED_MATCHUP_WIN_RATES,
  ROUND_LABELS,
} from "./backtest";
