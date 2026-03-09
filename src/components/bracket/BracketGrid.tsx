"use client";

/**
 * BracketGrid — main layout assembly for the full 64-team bracket.
 *
 * Reads all state from BracketContext via the useBracket hook. Arranges
 * four region brackets and the Final Four center section in a
 * three-column CSS Grid layout:
 *
 *   [Left regions (45%)]  [Center - Final Four (10%)]  [Right regions (45%)]
 *
 * Left side:  East (ltr) on top, South (ltr) on bottom
 * Right side: West (rtl) on top, Midwest (rtl) on bottom
 * Center:     FinalFour component
 *
 * This component:
 * 1. Gets state and dispatch from useBracket()
 * 2. Builds the 63-matchup tree using buildBracketMatchups() (memoized)
 * 3. Splits matchups by region + F4/NCG
 * 4. Computes ownership model via useContestStrategy()
 * 5. Passes props down to RegionBracket and FinalFour
 * 6. Wraps everything in a horizontally scrollable container
 */

import React, { useMemo, useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useContestStrategy } from "@/hooks/useContestStrategy";
import { buildBracketMatchups } from "@/lib/engine/bracket";
import type { Region } from "@/types/team";
import type { BracketMatchup } from "@/types/simulation";
import { RegionBracket } from "@/components/bracket/RegionBracket";
import { FinalFour } from "@/components/bracket/FinalFour";

// ---------------------------------------------------------------------------
// Layout Configuration
// ---------------------------------------------------------------------------

/**
 * Maps each region to its display side and direction.
 *
 * Standard NCAA bracket layout:
 * - Left side:  East (top-left, ltr), South (bottom-left, ltr)
 * - Right side: West (top-right, rtl), Midwest (bottom-right, rtl)
 */
const REGION_LAYOUT: Record<
  Region,
  { side: "left" | "right"; direction: "ltr" | "rtl" }
> = {
  East: { side: "left", direction: "ltr" },
  South: { side: "left", direction: "ltr" },
  West: { side: "right", direction: "rtl" },
  Midwest: { side: "right", direction: "rtl" },
};

/** Left-side regions in display order (top to bottom) */
const LEFT_REGIONS: Region[] = ["East", "South"];

/** Right-side regions in display order (top to bottom) */
const RIGHT_REGIONS: Region[] = ["West", "Midwest"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BracketGridProps {
  /** Handler for clicking a matchup to open the detail view */
  onMatchupClick?: (gameId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Splits the full 63-matchup array into per-region matchups and
 * Final Four/NCG matchups.
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

export function BracketGrid({ onMatchupClick }: BracketGridProps) {
  const { state, dispatch } = useBracket();
  const { ownershipModel } = useContestStrategy();

  // Build the 63-matchup tree (stable reference since it's pure)
  const allMatchups = useMemo(() => buildBracketMatchups(), []);

  // Split matchups by region
  const { regionMatchups, finalFourMatchups } = useMemo(
    () => splitMatchupsByRegion(allMatchups),
    [allMatchups]
  );

  // Handler for advancing a team — dispatches to context
  const handleAdvance = useCallback(
    (gameId: string, teamId: string) => {
      dispatch({ type: "ADVANCE_TEAM", gameId, teamId });
    },
    [dispatch]
  );

  // Handler for matchup detail click — forwarded from BracketShell
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
        }}
      >
        No team data loaded. Import team data from the admin panel to begin.
      </div>
    );
  }

  return (
    <div
      className="bracket-grid"
      style={{
        overflowX: "auto",
        overflowY: "hidden",
        width: "100%",
        padding: "8px 0",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(600px, 45%) minmax(200px, 10%) minmax(600px, 45%)",
          gap: "0px",
          minWidth: "1400px",
          alignItems: "stretch",
        }}
      >
        {/* Left side: East (top) + South (bottom) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {LEFT_REGIONS.map((region) => (
            <RegionBracket
              key={region}
              region={region}
              direction={REGION_LAYOUT[region].direction}
              matchups={regionMatchups[region]}
              teams={state.teams}
              picks={state.picks}
              simulationResult={state.simulationResult}
              matchupOverrides={state.matchupOverrides}
              onAdvance={handleAdvance}
              onMatchupClick={handleMatchupClick}
              ownershipModel={ownershipModel}
            />
          ))}
        </div>

        {/* Center: Final Four */}
        <FinalFour
          matchups={finalFourMatchups}
          teams={state.teams}
          picks={state.picks}
          simulationResult={state.simulationResult}
          matchupOverrides={state.matchupOverrides}
          onAdvance={handleAdvance}
          onMatchupClick={handleMatchupClick}
          ownershipModel={ownershipModel}
        />

        {/* Right side: West (top) + Midwest (bottom) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {RIGHT_REGIONS.map((region) => (
            <RegionBracket
              key={region}
              region={region}
              direction={REGION_LAYOUT[region].direction}
              matchups={regionMatchups[region]}
              teams={state.teams}
              picks={state.picks}
              simulationResult={state.simulationResult}
              matchupOverrides={state.matchupOverrides}
              onAdvance={handleAdvance}
              onMatchupClick={handleMatchupClick}
              ownershipModel={ownershipModel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
