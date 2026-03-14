"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { TeamSeason, TournamentSite } from "@/types/team";
import type { SavedBracketData } from "@/types/bracket-ui";
import type { PlayInConfig } from "@/types/simulation";
import { useMediaQuery, MOBILE_QUERY } from "@/hooks/useMediaQuery";
import { SITE_NAME } from "@/lib/constants";
import { BracketProvider } from "@/components/bracket/BracketProvider";
import { BracketGrid } from "@/components/bracket/BracketGrid";
import { LeverPanel } from "@/components/levers/LeverPanel";
import { SimulationButton } from "@/components/bracket/SimulationButton";
import { SimulationResultsOverlay } from "@/components/bracket/SimulationResultsOverlay";
import { GuidancePanel } from "@/components/bracket/GuidancePanel";
import { PoolSizeSelector } from "@/components/bracket/PoolSizeSelector";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SaveButton } from "./BracketShellSaveButton";
import { ClearPicksButton } from "./ClearPicksButton";

const MatchupView = dynamic(
  () =>
    import("@/components/matchup/MatchupView").then((mod) => ({
      default: mod.MatchupView,
    })),
  {
    loading: () => (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 50,
        }}
      >
        <LoadingSpinner size={40} />
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BracketShellProps {
  /** Initial tournament teams (64 without play-ins, or 68 with play-ins) */
  initialTeams: TeamSeason[];
  /** Optional saved bracket to restore */
  savedBracket?: SavedBracketData;
  /** Optional tournament site data for site proximity calculations */
  tournamentSites?: TournamentSite[];
  /** Optional play-in configuration for First Four games */
  playInConfig?: PlayInConfig | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Top-level client shell for the bracket page.
 *
 * Wraps everything in BracketProvider and manages local UI state for
 * panel visibility (levers drawer, results overlay, guidance panel, matchup detail view).
 *
 * Layout:
 * - Sticky header bar with bracket name, pool size selector, simulation button,
 *   guidance toggle, lever toggle, save button, and results toggle
 * - GuidancePanel (conditional, collapses in below header)
 * - SimulationResultsOverlay (conditional, collapses in below guidance)
 * - BracketGrid (full remaining space, scrollable)
 * - LeverPanel (right-side drawer)
 * - MatchupView (full-screen overlay, conditional on selectedMatchupId)
 */
export function BracketShell({ initialTeams, savedBracket, tournamentSites, playInConfig }: BracketShellProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [isLeverPanelOpen, setIsLeverPanelOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(false);
  const [selectedMatchupId, setSelectedMatchupId] = useState<string | null>(null);
  const [hasAutoOpenedResults, setHasAutoOpenedResults] = useState(false);

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

  const openMatchup = useCallback((gameId: string) => {
    setSelectedMatchupId(gameId);
  }, []);

  const closeMatchup = useCallback(() => {
    setSelectedMatchupId(null);
  }, []);

  const handleSimulationComplete = useCallback(() => {
    if (!hasAutoOpenedResults) {
      setIsResultsOpen(true);
      setHasAutoOpenedResults(true);
    }
  }, [hasAutoOpenedResults]);

  return (
    <BracketProvider initialTeams={initialTeams} savedBracket={savedBracket} tournamentSites={tournamentSites} playInConfig={playInConfig}>
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
            top: 48,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "8px 12px" : "10px 24px",
            backgroundColor: "var(--bg-primary)",
            borderBottom: "1px solid var(--border-primary)",
            gap: isMobile ? "8px" : "16px",
          }}
        >
          {/* Left section: bracket name + pool size */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "8px" : "16px",
              minWidth: 0,
              flex: isMobile ? "0 1 auto" : undefined,
            }}
          >
            {!isMobile && <SiteBrand />}
            <PoolSizeSelector />
          </div>

          {/* Right section: action buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? "6px" : "10px",
              flexShrink: 0,
            }}
          >
            <SimulationButton onSimulationComplete={handleSimulationComplete} />

            <button
              type="button"
              onClick={toggleResults}
              aria-pressed={isResultsOpen}
              title="Results"
              style={{
                padding: isMobile ? "6px 10px" : "8px 14px",
                fontSize: isMobile ? "0.75rem" : "0.8125rem",
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
              aria-pressed={isGuidanceOpen}
              title="Guidance"
              style={{
                padding: isMobile ? "6px 10px" : "8px 14px",
                fontSize: isMobile ? "0.75rem" : "0.8125rem",
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
              {isMobile ? "Guide" : "Guidance"}
            </button>

            <button
              type="button"
              onClick={toggleLevers}
              aria-pressed={isLeverPanelOpen}
              title="Levers"
              style={{
                padding: isMobile ? "6px 10px" : "8px 14px",
                fontSize: isMobile ? "0.75rem" : "0.8125rem",
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

            <ClearPicksButton />
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
          id="main-content"
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px 0",
          }}
        >
          <BracketGrid onMatchupClick={openMatchup} />
        </main>

        {/* Lever panel drawer */}
        <LeverPanel isOpen={isLeverPanelOpen} onClose={closeLevers} />

        {/* Matchup detail overlay */}
        {selectedMatchupId && (
          <MatchupView gameId={selectedMatchupId} onClose={closeMatchup} />
        )}
      </div>
    </BracketProvider>
  );
}

// ---------------------------------------------------------------------------
// SiteBrand — site name in the bracket header
// ---------------------------------------------------------------------------

/** Displays the site name in the bracket header bar. */
function SiteBrand() {
  return (
    <div
      style={{
        fontSize: "1rem",
        fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "0.01em",
      }}
    >
      {SITE_NAME}
    </div>
  );
}
