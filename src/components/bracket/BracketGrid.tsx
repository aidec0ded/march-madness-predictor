"use client";

/**
 * BracketGrid — main layout assembly for the full bracket (64 or 68 teams).
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
 * When play-in config exists (68-team bracket), a FirstFour horizontal
 * strip renders above the main grid showing the 4 play-in matchups.
 *
 * This component:
 * 1. Gets state and dispatch from useBracket()
 * 2. Builds the matchup tree using buildBracketMatchups() (memoized, dynamic)
 * 3. Splits matchups by region + F4/NCG + FF
 * 4. Computes ownership model via useContestStrategy()
 * 5. Passes props down to FirstFour and FinalFour; RegionBracket reads
 *    context directly via useBracket(), useContestStrategy(), and
 *    useGameProbabilities() hooks
 * 6. Wraps everything in a horizontally scrollable container
 */

import React, { useMemo, useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { useContestStrategy } from "@/hooks/useContestStrategy";
import { useGameProbabilities } from "@/hooks/useGameProbabilities";
import { useMediaQuery, MOBILE_QUERY } from "@/hooks/useMediaQuery";
import type { Region } from "@/types/team";
import type { BracketMatchup } from "@/types/simulation";
import { RegionBracket } from "@/components/bracket/RegionBracket";
import { FinalFour } from "@/components/bracket/FinalFour";
import { FirstFour } from "@/components/bracket/FirstFour";
import { MobileBracketView } from "./MobileBracketView";

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
 * Splits the full matchup array into per-region matchups,
 * Final Four/NCG matchups, and First Four play-in matchups.
 */
function splitMatchupsByRegion(matchups: BracketMatchup[]): {
  regionMatchups: Record<Region, BracketMatchup[]>;
  finalFourMatchups: BracketMatchup[];
  firstFourMatchups: BracketMatchup[];
} {
  const regionMatchups: Record<Region, BracketMatchup[]> = {
    East: [],
    West: [],
    South: [],
    Midwest: [],
  };
  const finalFourMatchups: BracketMatchup[] = [];
  const firstFourMatchups: BracketMatchup[] = [];

  for (const matchup of matchups) {
    if (matchup.round === "FF") {
      firstFourMatchups.push(matchup);
    } else if (matchup.round === "F4" || matchup.round === "NCG") {
      finalFourMatchups.push(matchup);
    } else if (matchup.region && matchup.region in regionMatchups) {
      regionMatchups[matchup.region].push(matchup);
    }
  }

  return { regionMatchups, finalFourMatchups, firstFourMatchups };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BracketGrid({ onMatchupClick }: BracketGridProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { state, dispatch, allMatchups } = useBracket();
  const { ownershipModel } = useContestStrategy();
  const gameProbabilities = useGameProbabilities();

  // Split matchups by region (includes FF extraction)
  const { regionMatchups, finalFourMatchups, firstFourMatchups } = useMemo(
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

  // On mobile, delegate to the tab-based MobileBracketView
  if (isMobile) {
    return <MobileBracketView onMatchupClick={onMatchupClick} />;
  }

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
      {/* First Four play-in games (only when 68-team bracket) */}
      {firstFourMatchups.length > 0 && (
        <div
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: "8px",
          }}
        >
          <FirstFour
            matchups={firstFourMatchups}
            teams={state.teams}
            picks={state.picks}
            simulationResult={state.simulationResult}
            matchupOverrides={state.matchupOverrides}
            onAdvance={handleAdvance}
            onMatchupClick={handleMatchupClick}
            ownershipModel={ownershipModel}
            gameProbabilities={gameProbabilities}
            playInConfig={state.playInConfig}
          />
        </div>
      )}

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
              onMatchupClick={handleMatchupClick}
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
          gameProbabilities={gameProbabilities}
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
              onMatchupClick={handleMatchupClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
