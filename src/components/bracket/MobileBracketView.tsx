"use client";

/**
 * MobileBracketView -- tab-based bracket layout for mobile viewports.
 *
 * Instead of rendering all four regions simultaneously in a 3-column grid,
 * this component shows one region at a time via a tab bar. The user can
 * switch between East, West, South, Midwest, and Final 4 tabs.
 *
 * Reads the same state as BracketGrid (via useBracket, useContestStrategy,
 * useGameProbabilities) and passes identical props to RegionBracket and
 * FinalFour sub-components.
 */

import React, { useState, useMemo, useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useContestStrategy } from "@/hooks/useContestStrategy";
import { useGameProbabilities } from "@/hooks/useGameProbabilities";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import type { Region } from "@/types/team";
import type { BracketMatchup } from "@/types/simulation";
import { RegionBracket } from "@/components/bracket/RegionBracket";
import { FinalFour } from "@/components/bracket/FinalFour";

// ---------------------------------------------------------------------------
// Layout Configuration
// ---------------------------------------------------------------------------

/**
 * Maps each region to its display direction (same as BracketGrid).
 * Left-side regions flow ltr, right-side regions flow rtl.
 */
const REGION_DIRECTION: Record<Region, "ltr" | "rtl"> = {
  East: "ltr",
  South: "ltr",
  West: "rtl",
  Midwest: "rtl",
};

/** All available tabs in display order */
type TabId = Region | "Final 4";
const TABS: TabId[] = ["East", "West", "South", "Midwest", "Final 4"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MobileBracketViewProps {
  /** Handler for clicking a matchup to open the detail view */
  onMatchupClick?: (gameId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Splits the full 63-matchup array into per-region matchups and
 * Final Four/NCG matchups. Same logic as BracketGrid.
 */
function splitMatchupsByRegion(matchups: BracketMatchup[]): {
  regionMatchups: Record<Region, BracketMatchup[]>;
  finalFourMatchups: BracketMatchup[];
} {
  const regionMatchups: Record<Region, BracketMatchup[]> = {
    East: [],
    West: [],
    South: [],
    Midwest: [],
  };
  const finalFourMatchups: BracketMatchup[] = [];

  for (const matchup of matchups) {
    if (matchup.round === "F4" || matchup.round === "NCG") {
      finalFourMatchups.push(matchup);
    } else if (matchup.region && matchup.region in regionMatchups) {
      regionMatchups[matchup.region].push(matchup);
    }
  }

  return { regionMatchups, finalFourMatchups };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileBracketView({ onMatchupClick }: MobileBracketViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("East");
  const { state, dispatch } = useBracket();
  const { ownershipModel } = useContestStrategy();
  const gameProbabilities = useGameProbabilities();

  // Build the 63-matchup tree (stable reference since it's pure)
  const allMatchups = useMemo(() => buildBracketMatchups(), []);

  // Split matchups by region
  const { regionMatchups, finalFourMatchups } = useMemo(
    () => splitMatchupsByRegion(allMatchups),
    [allMatchups]
  );

  // Handler for advancing a team -- dispatches to context
  const handleAdvance = useCallback(
    (gameId: string, teamId: string) => {
      dispatch({ type: "ADVANCE_TEAM", gameId, teamId });
    },
    [dispatch]
  );

  // Handler for matchup detail click
  const handleMatchupClick = useCallback(
    (gameId: string) => {
      if (onMatchupClick) onMatchupClick(gameId);
    },
    [onMatchupClick]
  );

  // Empty state
  if (state.teams.size === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          color: "var(--text-muted)",
          fontSize: "14px",
          padding: "0 16px",
          textAlign: "center",
        }}
      >
        No team data loaded. Import team data from the admin panel to begin.
      </div>
    );
  }

  return (
    <div className="mobile-bracket-view">
      {/* Tab bar */}
      <div className="mobile-bracket-tabs" role="tablist" aria-label="Bracket regions">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`region-panel-${tab}`}
            className={`mobile-bracket-tab${activeTab === tab ? " mobile-bracket-tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Region content */}
      <div
        id={`region-panel-${activeTab}`}
        role="tabpanel"
        aria-label={`${activeTab} bracket`}
        className="mobile-bracket-region-container"
      >
        {activeTab === "Final 4" ? (
          <FinalFour
            matchups={finalFourMatchups}
            teams={state.teams}
            picks={state.picks}
            simulationResult={state.simulationResult}
            matchupOverrides={state.matchupOverrides}
            onAdvance={handleAdvance}
            onMatchupClick={handleMatchupClick}
            ownershipModel={ownershipModel}
            gameProbabilities={gameProbabilities}
          />
        ) : (
          <RegionBracket
            region={activeTab}
            direction={REGION_DIRECTION[activeTab]}
            matchups={regionMatchups[activeTab]}
            teams={state.teams}
            picks={state.picks}
            simulationResult={state.simulationResult}
            matchupOverrides={state.matchupOverrides}
            onAdvance={handleAdvance}
            onMatchupClick={handleMatchupClick}
            ownershipModel={ownershipModel}
            gameProbabilities={gameProbabilities}
          />
        )}
      </div>
    </div>
  );
}
