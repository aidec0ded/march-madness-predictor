"use client";

import { useCallback, useRef } from "react";
import { useBracket, useSimulationProgress } from "./useBracket";
import type { SimulationResult } from "@/types/simulation";
import type { SimulationProgress } from "@/types/bracket-ui";
import { CURRENT_SEASON } from "@/lib/constants";

// ---------------------------------------------------------------------------
// SSE parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parses a single SSE frame (multi-line text block) into event name + data.
 *
 * Expected format:
 * ```
 * event: progress
 * data: {"completed":1000,"total":50000,"elapsedMs":312}
 * ```
 *
 * Returns null for empty or unparseable frames.
 */
function parseSSEFrame(frame: string): { event: string; data: string } | null {
  let event = "";
  let data = "";

  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice(7);
    } else if (line.startsWith("data: ")) {
      data = line.slice(6);
    }
  }

  if (!event || !data) return null;
  return { event, data };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for triggering Monte Carlo bracket simulations via SSE streaming.
 *
 * Calls POST /api/simulate/stream with the current global levers and matchup
 * overrides, consumes the Server-Sent Event stream for real-time progress
 * reporting, and dispatches results into BracketContext.
 *
 * Progress updates are routed to the separate SimulationProgressContext
 * so that frequent progress ticks don't re-render the entire bracket tree.
 *
 * Falls back to the non-streaming /api/simulate endpoint if streaming fails
 * (e.g., browser doesn't support ReadableStream).
 *
 * Must be used within a BracketProvider.
 */
export function useBracketSimulation() {
  const { state, dispatch } = useBracket();
  const { progress: simulationProgress, setProgress } = useSimulationProgress();
  const abortRef = useRef<AbortController | null>(null);

  const simulate = useCallback(
    async (options?: { numSimulations?: number }) => {
      // Abort any in-flight simulation
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "SET_SIMULATING", isSimulating: true });
      setProgress(null);

      try {
        const body = JSON.stringify({
          season: CURRENT_SEASON,
          numSimulations: options?.numSimulations ?? 10000,
          engineConfig: {
            levers: state.globalLevers,
          },
          matchupOverrides:
            Object.keys(state.matchupOverrides).length > 0
              ? state.matchupOverrides
              : undefined,
          picks:
            Object.keys(state.picks).length > 0
              ? state.picks
              : undefined,
          playInConfig: state.playInConfig ?? undefined,
        });

        const res = await fetch("/api/simulate/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });

        // If the streaming endpoint returns a non-200 JSON error, handle it
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Simulation failed (${res.status})`);
        }

        // Consume the SSE stream
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("ReadableStream not supported");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let result: SimulationResult | null = null;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by double newlines
          const frames = buffer.split("\n\n");
          // Keep the last incomplete frame in the buffer
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const trimmed = frame.trim();
            if (!trimmed) continue;

            const parsed = parseSSEFrame(trimmed);
            if (!parsed) continue;

            switch (parsed.event) {
              case "progress": {
                const progress = JSON.parse(parsed.data) as SimulationProgress;
                setProgress(progress);
                break;
              }
              case "result": {
                const payload = JSON.parse(parsed.data) as {
                  success: boolean;
                  result: SimulationResult;
                };
                if (payload.success && payload.result) {
                  result = payload.result;
                  dispatch({
                    type: "SET_SIMULATION_RESULT",
                    result: payload.result,
                  });
                } else {
                  throw new Error("Simulation returned unsuccessful result");
                }
                break;
              }
              case "error": {
                const errorPayload = JSON.parse(parsed.data) as {
                  success: boolean;
                  error: string;
                };
                throw new Error(errorPayload.error || "Simulation failed");
              }
            }
          }
        }

        if (!result) {
          throw new Error("Stream ended without a result event");
        }

        return result;
      } catch (error) {
        // Don't re-throw abort errors
        if (error instanceof DOMException && error.name === "AbortError") {
          return undefined;
        }
        throw error;
      } finally {
        dispatch({ type: "SET_SIMULATING", isSimulating: false });
        setProgress(null);
        abortRef.current = null;
      }
    },
    [state.globalLevers, state.matchupOverrides, state.picks, state.playInConfig, dispatch, setProgress]
  );

  return {
    simulate,
    isSimulating: state.isSimulating,
    simulationResult: state.simulationResult,
    simulationProgress,
    isSimulationStale: state.isSimulationStale,
  };
}
