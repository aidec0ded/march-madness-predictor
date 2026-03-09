/**
 * Data import and normalization module for the March Madness Bracket Predictor.
 *
 * Re-exports all public APIs from the data pipeline:
 * - CSV parsing
 * - Source-specific normalizers (KenPom, Torvik, Evan Miya)
 * - Data fetchers (Torvik)
 * - Multi-source data merger
 * - Field validation
 */

// CSV parser
export { parseCsv } from "./csv-parser";
export type { CsvParseOptions } from "./csv-parser";

// Normalizers
export { normalizeKenPom } from "./normalizers/kenpom";
export type { KenPomNormalizerResult } from "./normalizers/kenpom";

export { mergeKenPomCsvs } from "./normalizers/kenpom-csv-merger";
export type { KenPomMergeResult } from "./normalizers/kenpom-csv-merger";

export { normalizeTorvik } from "./normalizers/torvik";
export type { TorvikNormalizerResult } from "./normalizers/torvik";

export { normalizeEvanMiya } from "./normalizers/evanmiya";
export type { EvanMiyaNormalizerResult } from "./normalizers/evanmiya";

// Fetchers
export { fetchTorvikData } from "./fetchers/torvik";
export type { TorvikFetchResult } from "./fetchers/torvik";

// Merger
export { mergeTeamData } from "./merger";
export type { MergeSource } from "./merger";

// Validation
export { validateTeamSeason, validateBatch } from "./validation";

// Upsert helpers
export {
  nanToNull,
  generateShortName,
  upsertTeams,
  upsertTeamSeasons,
  upsertNameMappings,
  recordImportJob,
} from "./upsert-helpers";
export type {
  TeamUpsertRecord,
  TeamSeasonUpsertRecord,
  UpsertStats,
  NameMappingUpsertRecord,
  ImportJobRecord,
} from "./upsert-helpers";
