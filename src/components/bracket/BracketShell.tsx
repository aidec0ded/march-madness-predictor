"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { TeamSeason, TournamentSite } from "@/types/team";
import type { SavedBracketData } from "@/types/bracket-ui";
import type { PlayInConfig } from "@/types/simulation";
import { useMediaQuery, MOBILE_QUERY } from "@/hooks/useMediaQuery";
import { TOURNAMENT_TITLE } from "@/lib/constants";
import styles from "./BracketShell.module.css";
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
import { useAutoSimulation } from "@/hooks/useAutoSimulation";

const MatchupView = dynamic(
  () =>
    import("@/components/matchup/MatchupView").then((mod) => ({
      default: mod.MatchupView,
    })),
  {
    loading: () => (
      <div className={styles.loadingOverlay}>
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
  const [showGuideHint, setShowGuideHint] = useState(false);

  // Show a hint dot on the Guide button for first-time visitors
  useEffect(() => {
    try {
      const seen = localStorage.getItem("bracketlab-guide-seen");
      if (!seen) setShowGuideHint(true);
    } catch {
      // localStorage not available — no hint
    }
  }, []);

  const toggleLevers = useCallback(() => {
    setIsLeverPanelOpen((prev) => !prev);
  }, []);

  const toggleResults = useCallback(() => {
    setIsResultsOpen((prev) => !prev);
  }, []);

  const toggleGuidance = useCallback(() => {
    setIsGuidanceOpen((prev) => !prev);
    // Dismiss the hint dot on first click
    if (showGuideHint) {
      setShowGuideHint(false);
      try {
        localStorage.setItem("bracketlab-guide-seen", "1");
      } catch {
        // localStorage not available
      }
    }
  }, [showGuideHint]);

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
      <AutoSimulationTrigger />
      <div className={styles.shell}>
        {/* Sticky header bar */}
        <header className={`${styles.header} ${isMobile ? styles.headerMobile : ""}`}>
          {/* Left section: bracket name + pool size */}
          <div className={`${styles.headerLeft} ${isMobile ? styles.headerLeftMobile : ""}`}>
            {!isMobile && <SiteBrand />}
            <PoolSizeSelector />
          </div>

          {/* Right section: action buttons */}
          <div className={`${styles.headerRight} ${isMobile ? styles.headerRightMobile : ""}`}>
            <SimulationButton onSimulationComplete={handleSimulationComplete} compact={isMobile} />

            <button
              type="button"
              onClick={toggleResults}
              aria-pressed={isResultsOpen}
              title="Results"
              className={`${styles.toggleButton} ${isMobile ? styles.toggleButtonMobile : ""} ${isResultsOpen ? styles.toggleButtonActive : ""}`}
            >
              Results
            </button>

            <button
              type="button"
              onClick={toggleGuidance}
              aria-pressed={isGuidanceOpen}
              title="Guidance — tips, warnings, and strategy recommendations for your bracket"
              className={`${styles.guideButton} ${isMobile ? styles.toggleButtonMobile : ""} ${isGuidanceOpen ? styles.toggleButtonActive : ""}`}
            >
              {/* Info icon */}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Guide
              {/* First-visit hint dot */}
              {showGuideHint && (
                <span
                  className={styles.hintDot}
                  aria-label="New — click to see bracket guidance"
                />
              )}
            </button>

            <button
              type="button"
              onClick={toggleLevers}
              aria-pressed={isLeverPanelOpen}
              title="Levers"
              className={`${styles.toggleButton} ${isMobile ? styles.toggleButtonMobile : ""} ${isLeverPanelOpen ? styles.toggleButtonActive : ""}`}
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
        <main id="main-content" className={styles.main}>
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
// AutoSimulationTrigger — fires a background simulation on first load
// ---------------------------------------------------------------------------

/**
 * Must be rendered inside BracketProvider. Calls useAutoSimulation to fire
 * a background simulation when teams are loaded but no results exist.
 * Renders nothing — this is a hook-only component.
 */
function AutoSimulationTrigger() {
  useAutoSimulation();
  return null;
}

// ---------------------------------------------------------------------------
// SiteBrand — tournament title in the bracket header
// ---------------------------------------------------------------------------

/** Displays the tournament title in the bracket header bar. */
function SiteBrand() {
  return (
    <div className={styles.siteBrand}>
      {TOURNAMENT_TITLE}
    </div>
  );
}
