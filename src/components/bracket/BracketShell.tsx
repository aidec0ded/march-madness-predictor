"use client";

import { useState, useCallback } from "react";
import type { TeamSeason } from "@/types/team";
import type { SavedBracketData } from "@/types/bracket-ui";
import { BracketProvider } from "@/components/bracket/BracketProvider";
import { BracketGrid } from "@/components/bracket/BracketGrid";
import { LeverPanel } from "@/components/levers/LeverPanel";
import { SimulationButton } from "@/components/bracket/SimulationButton";
import { SimulationResultsOverlay } from "@/components/bracket/SimulationResultsOverlay";
import { GuidancePanel } from "@/components/bracket/GuidancePanel";
import { PoolSizeSelector } from "@/components/bracket/PoolSizeSelector";
import { SaveButton } from "./BracketShellSaveButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BracketShellProps {
  /** Initial 64 tournament teams loaded on the server */
  initialTeams: TeamSeason[];
  /** Optional saved bracket to restore */
  savedBracket?: SavedBracketData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Top-level client shell for the bracket page.
 *
 * Wraps everything in BracketProvider and manages local UI state for
 * panel visibility (levers drawer, results overlay, guidance panel).
 *
 * Layout:
 * - Sticky header bar with bracket name, pool size selector, simulation button,
 *   guidance toggle, lever toggle, save button, and results toggle
 * - GuidancePanel (conditional, collapses in below header)
 * - SimulationResultsOverlay (conditional, collapses in below guidance)
 * - BracketGrid (full remaining space, scrollable)
 * - LeverPanel (right-side drawer)
 */
export function BracketShell({ initialTeams, savedBracket }: BracketShellProps) {
  const [isLeverPanelOpen, setIsLeverPanelOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);

  const toggleLevers = useCallback(() => {
    setIsLeverPanelOpen((prev) => !prev);
  }, []);

  const toggleResults = useCallback(() => {
    setIsResultsOpen((prev) => !prev);
  }, []);

  const toggleGuidance = useCallback(() => {
    setIsGuidanceOpen((prev) => !prev);
  }, []);

  const closeResults = useCallback(() => {
    setIsResultsOpen(false);
  }, []);

  const closeLevers = useCallback(() => {
    setIsLeverPanelOpen(false);
  }, []);

  const closeGuidance = useCallback(() => {
    setIsGuidanceOpen(false);
  }, []);

  return (
    <BracketProvider initialTeams={initialTeams} savedBracket={savedBracket}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {/* Sticky header bar */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 24px",
            backgroundColor: "var(--bg-primary)",
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          {/* Left section: bracket name + pool size */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <BracketName />
            <PoolSizeSelector />
          </div>

          {/* Right section: action buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <SimulationButton />

            <button
              type="button"
              onClick={toggleResults}
              style={{
                padding: "8px 14px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: isResultsOpen
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
                backgroundColor: isResultsOpen
                  ? "rgba(74, 144, 217, 0.1)"
                  : "transparent",
                border: "1px solid var(--border-primary)",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Results
            </button>

            <button
              type="button"
              onClick={toggleGuidance}
              style={{
                padding: "8px 14px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: isGuidanceOpen
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
                backgroundColor: isGuidanceOpen
                  ? "rgba(74, 144, 217, 0.1)"
                  : "transparent",
                border: "1px solid var(--border-primary)",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Guidance
            </button>

            <button
              type="button"
              onClick={toggleLevers}
              style={{
                padding: "8px 14px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: isLeverPanelOpen
                  ? "var(--accent-primary)"
                  : "var(--text-secondary)",
                backgroundColor: isLeverPanelOpen
                  ? "rgba(74, 144, 217, 0.1)"
                  : "transparent",
                border: "1px solid var(--border-primary)",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Levers
            </button>

            <SaveButton />
          </div>
        </header>

        {/* Guidance panel (conditional) */}
        <GuidancePanel isOpen={isGuidanceOpen} onClose={closeGuidance} />

        {/* Simulation results overlay (conditional) */}
        <SimulationResultsOverlay
          isOpen={isResultsOpen}
          onClose={closeResults}
        />

        {/* Main bracket area */}
        <main
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px 0",
          }}
        >
          <BracketGrid />
        </main>

        {/* Lever panel drawer */}
        <LeverPanel isOpen={isLeverPanelOpen} onClose={closeLevers} />
      </div>
    </BracketProvider>
  );
}

// ---------------------------------------------------------------------------
// BracketName — inline editable bracket name
// ---------------------------------------------------------------------------

/**
 * Editable bracket name in the header bar.
 * Reads bracketName from context. In this version, it's display-only
 * since SET_BRACKET_NAME is not yet in the reducer (could be added).
 */
function BracketName() {
  return (
    <div
      style={{
        fontSize: "1rem",
        fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "0.01em",
      }}
    >
      March Madness 2026
    </div>
  );
}
