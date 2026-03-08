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
 * 4. Passes props down to RegionBracket and FinalFour
 * 5. Wraps everything in a horizontally scrollable container
 */

import React, { useMemo, useCallback } from "react";
import { useBracket } from "@/hooks/useBracket";
import { buildBracketMatchups, REGIONS } from "@/lib/engine/bracket";
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
// Loading State
// ---------------------------------------------------------------------------

function BracketLoading() {
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
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid var(--border-subtle)",
            borderTopColor: "var(--accent-primary)",
            borderRadius: "50%",
            animation: "bracket-spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        Loading bracket data...
        <style>{`
          @keyframes bracket-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

function BracketError({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        color: "var(--accent-danger)",
        fontSize: "14px",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div>
        <div
          style={{ fontSize: "20px", marginBottom: "8px", fontWeight: 700 }}
        >
          Error
        </div>
        <div style={{ color: "var(--text-secondary)" }}>{message}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BracketGrid() {
  const { state, dispatch } = useBracket();

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

  // Handler for matchup detail click
  const handleMatchupClick = useCallback((_gameId: string) => {
    // Navigation to matchup view will be implemented when the
    // matchup detail page is built. For now, this is a no-op placeholder.
    // TODO: Navigate to /matchup/[gameId] or open a modal
  }, []);

  // Loading state
  if (state.isLoading) {
    return <BracketLoading />;
  }

  // Error state
  if (state.error) {
    return <BracketError message={state.error} />;
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
