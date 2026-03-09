"use client";

import { useState, useCallback } from "react";
import type { EngineConfig } from "@/types/engine";
import { DEFAULT_ENGINE_CONFIG } from "@/types/engine";
import type { BacktestResult } from "@/types/backtest";
import { ALL_SEASONS } from "@/types/backtest";

export interface UseBacktestResult {
  /** Selected seasons for evaluation */
  selectedSeasons: number[];
  setSelectedSeasons: (seasons: number[]) => void;

  /** Isolated engine config for backtest lever tuning */
  engineConfig: EngineConfig;
  setEngineConfig: (config: EngineConfig) => void;

  /** Current backtest results */
  result: BacktestResult | null;

  /** Loading/error state */
  isRunning: boolean;
  error: string | null;

  /** Trigger a backtest run */
  runBacktest: () => Promise<void>;

  /** Reset to initial state */
  reset: () => void;
}

/**
 * Deep-copies the default engine config so mutations in one backtest session
 * never leak into another (or into the bracket context).
 */
function cloneDefaultConfig(): EngineConfig {
  return JSON.parse(JSON.stringify(DEFAULT_ENGINE_CONFIG)) as EngineConfig;
}

/**
 * Client-side hook that manages backtest state, API calls, and lever
 * configuration. This is intentionally isolated from the bracket context
 * so lever tuning during backtesting does not affect the user's live
 * bracket probabilities.
 */
export function useBacktest(): UseBacktestResult {
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([
    ...ALL_SEASONS,
  ]);
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(
    cloneDefaultConfig,
  );
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = useCallback(async () => {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasons: selectedSeasons,
          engineConfig,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error ?? `Backtest request failed (${response.status})`,
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error ?? "Backtest returned an unsuccessful result");
      }

      setResult(data.result as BacktestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [selectedSeasons, engineConfig]);

  const reset = useCallback(() => {
    setSelectedSeasons([...ALL_SEASONS]);
    setEngineConfig(cloneDefaultConfig());
    setResult(null);
    setError(null);
    setIsRunning(false);
  }, []);

  return {
    selectedSeasons,
    setSelectedSeasons,
    engineConfig,
    setEngineConfig,
    result,
    isRunning,
    error,
    runBacktest,
    reset,
  };
}
