"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useBracketSimulation } from "@/hooks/useBracketSimulation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ButtonState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimulationButtonProps {
  /** Called after a simulation completes successfully. */
  onSimulationComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Simulation trigger button with visual feedback for loading, success, and error states.
 *
 * States:
 * - idle:    "Run Simulation" with play icon, blue background
 * - idle (stale): "Re-run Simulation" with play icon + amber dot
 * - loading: "Simulating... XX%" with spinner + thin progress bar, disabled
 * - success: "Done" with checkmark, green background (reverts after 2s)
 * - error:   Error message, red background (reverts after 3s)
 *
 * Shows a thin 2px progress bar at the bottom of the button during streaming
 * simulations. Progress percentage is shown in the label text.
 *
 * Reads simulation state from useBracketSimulation hook.
 */
export function SimulationButton({ onSimulationComplete }: SimulationButtonProps) {
  const { simulate, isSimulating, isSimulationStale, simulationProgress } =
    useBracketSimulation();
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (buttonState === "loading" || isSimulating) return;

    setButtonState("loading");
    setErrorMessage("");

    try {
      await simulate();
      setButtonState("success");
      onSimulationComplete?.();
      timeoutRef.current = setTimeout(() => {
        setButtonState("idle");
      }, 2000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Simulation failed";
      setErrorMessage(msg);
      setButtonState("error");
      timeoutRef.current = setTimeout(() => {
        setButtonState("idle");
        setErrorMessage("");
      }, 3000);
    }
  }, [buttonState, isSimulating, simulate, onSimulationComplete]);

  // Derive display properties from state
  const isDisabled = buttonState === "loading" || isSimulating;

  // Progress percentage (0–100)
  const progressPct =
    simulationProgress && simulationProgress.total > 0
      ? Math.round((simulationProgress.completed / simulationProgress.total) * 100)
      : 0;

  let backgroundColor: string;
  let label: string;

  switch (buttonState) {
    case "loading":
      backgroundColor = "var(--accent-primary)";
      label = progressPct > 0 ? `Simulating... ${progressPct}%` : "Simulating...";
      break;
    case "success":
      backgroundColor = "var(--accent-success)";
      label = "Done";
      break;
    case "error":
      backgroundColor = "var(--accent-danger)";
      label = errorMessage || "Error";
      break;
    default:
      backgroundColor = "var(--accent-primary)";
      label = isSimulationStale ? "Re-run Simulation" : "Run Simulation";
      break;
  }

  const tooltip = isSimulationStale
    ? "Your picks or levers changed since the last simulation. Re-run to update path probabilities and championship odds."
    : "Run 10,000 bracket simulations to see each team's path probabilities and championship odds. Per-game win rates update instantly — simulation adds full-bracket path analysis.";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={buttonState === "loading"}
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        fontSize: "0.8125rem",
        fontWeight: 600,
        color: "#ffffff",
        backgroundColor,
        border: "none",
        borderRadius: "6px",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.7 : 1,
        transition: "background-color 0.2s ease, opacity 0.2s ease",
        whiteSpace: "nowrap",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Progress bar — thin 2px strip at the bottom of the button */}
      {buttonState === "loading" && progressPct > 0 && (
        <span
          data-testid="simulation-progress-bar"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "2px",
            width: `${progressPct}%`,
            backgroundColor: "rgba(255, 255, 255, 0.7)",
            transition: "width 0.3s ease",
            borderRadius: "0 0 6px 6px",
          }}
        />
      )}
      {buttonState === "loading" && <LoadingSpinner size={16} />}
      {buttonState === "idle" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {buttonState === "success" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {buttonState === "error" && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )}
      <span>{label}</span>
      {buttonState === "idle" && isSimulationStale && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "var(--accent-warning)",
            flexShrink: 0,
          }}
          aria-label="Simulation results are outdated"
        />
      )}
    </button>
  );
}
