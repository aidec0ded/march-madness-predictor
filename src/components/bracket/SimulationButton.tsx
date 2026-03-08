"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useBracketSimulation } from "@/hooks/useBracketSimulation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ButtonState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Simulation trigger button with visual feedback for loading, success, and error states.
 *
 * States:
 * - idle:    "Run Simulation" with play icon, blue background
 * - loading: "Simulating..." with spinner, disabled, reduced opacity
 * - success: "Done" with checkmark, green background (reverts after 2s)
 * - error:   Error message, red background (reverts after 3s)
 *
 * Reads simulation state from useBracketSimulation hook.
 */
export function SimulationButton() {
  const { simulate, isSimulating } = useBracketSimulation();
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
  }, [buttonState, isSimulating, simulate]);

  // Derive display properties from state
  const isDisabled = buttonState === "loading" || isSimulating;

  let backgroundColor: string;
  let label: string;

  switch (buttonState) {
    case "loading":
      backgroundColor = "var(--accent-primary)";
      label = "Simulating...";
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
      label = "Run Simulation";
      break;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={buttonState === "loading"}
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
      }}
    >
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
    </button>
  );
}
