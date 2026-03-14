import type { EngineConfig } from "@/types/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";

/**
 * Merges a partial engine config with the defaults to produce a complete
 * EngineConfig. Fields not specified in the partial will use defaults.
 *
 * @param partial - Optional partial engine configuration from the request
 * @returns A complete EngineConfig
 */
export function resolveEngineConfig(partial?: Partial<EngineConfig>): EngineConfig {
  if (!partial) {
    return { ...DEFAULT_ENGINE_CONFIG };
  }

  return {
    levers: partial.levers
      ? { ...DEFAULT_ENGINE_CONFIG.levers, ...partial.levers }
      : { ...DEFAULT_ENGINE_CONFIG.levers },
    logisticK: partial.logisticK ?? DEFAULT_ENGINE_CONFIG.logisticK,
    baseVariance: partial.baseVariance ?? DEFAULT_ENGINE_CONFIG.baseVariance,
  };
}
