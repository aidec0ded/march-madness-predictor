/**
 * Grid position calculator for the bracket layout.
 *
 * Maps gameIds to CSS Grid coordinates for rendering the bracket.
 * Each region uses a 4-column × 16-row grid, with matchups progressively
 * centered as rounds advance:
 *
 * - R64 (8 games): 2 rows each → rows 1-2, 3-4, ..., 15-16
 * - R32 (4 games): 4 rows each → rows 1-4, 5-8, 9-12, 13-16
 * - S16 (2 games): 8 rows each → rows 1-8, 9-16
 * - E8 (1 game):  16 rows      → rows 1-16
 *
 * Direction controls whether R64 is on the left (ltr) or right (rtl),
 * which allows the bracket to fold inward toward the Final Four center.
 *
 * All functions are pure (no side effects).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** CSS Grid position for a matchup slot. */
export interface GridPosition {
  /** 1-based grid row start */
  gridRowStart: number;
  /** 1-based grid row end (exclusive) */
  gridRowEnd: number;
  /** 1-based grid column */
  gridColumn: number;
}

/** Parsed game ID components. */
export interface ParsedGameId {
  /** Tournament round (R64, R32, S16, E8, F4, NCG) */
  round: string;
  /** Region name (undefined for F4 and NCG) */
  region?: string;
  /** Game number within the round/region (undefined for E8 and NCG) */
  gameNum?: number;
}

// ---------------------------------------------------------------------------
// Game ID parser
// ---------------------------------------------------------------------------

/**
 * Parses a game ID string into its components.
 *
 * Game ID formats:
 * - "R64-East-3"  → { round: "R64", region: "East", gameNum: 3 }
 * - "R32-West-2"  → { round: "R32", region: "West", gameNum: 2 }
 * - "S16-South-1" → { round: "S16", region: "South", gameNum: 1 }
 * - "E8-East"     → { round: "E8", region: "East" }
 * - "F4-1"        → { round: "F4", gameNum: 1 }
 * - "NCG"         → { round: "NCG" }
 *
 * @param gameId - The game identifier string
 * @returns Parsed components of the game ID
 * @throws {Error} If the game ID format is not recognized
 */
export function parseGameId(gameId: string): ParsedGameId {
  // NCG — no region, no game number
  if (gameId === "NCG") {
    return { round: "NCG" };
  }

  const parts = gameId.split("-");

  if (parts.length < 2) {
    throw new Error(`Invalid gameId format: "${gameId}"`);
  }

  const round = parts[0];

  // F4-1, F4-2 — no region
  if (round === "F4") {
    return {
      round: "F4",
      gameNum: parseInt(parts[1], 10),
    };
  }

  // E8-East, E8-West, etc. — region but no game number
  if (round === "E8") {
    return {
      round: "E8",
      region: parts[1],
    };
  }

  // R64-East-3, R32-West-1, S16-South-2, etc.
  if (parts.length >= 3) {
    return {
      round,
      region: parts[1],
      gameNum: parseInt(parts[2], 10),
    };
  }

  throw new Error(`Invalid gameId format: "${gameId}"`);
}

// ---------------------------------------------------------------------------
// Grid position constants
// ---------------------------------------------------------------------------

/**
 * Column assignment for each round.
 * LTR: R64 at left, advancing rightward toward the center.
 * RTL: R64 at right, advancing leftward toward the center.
 */
const ROUND_COLUMNS: Record<string, { ltr: number; rtl: number }> = {
  R64: { ltr: 1, rtl: 4 },
  R32: { ltr: 2, rtl: 3 },
  S16: { ltr: 3, rtl: 2 },
  E8: { ltr: 4, rtl: 1 },
};

/**
 * Row span size per round. Each successive round doubles the span
 * so matchups center between their two feeder games.
 */
const ROUND_ROW_SPAN: Record<string, number> = {
  R64: 2,
  R32: 4,
  S16: 8,
  E8: 16,
};

// ---------------------------------------------------------------------------
// Position calculator
// ---------------------------------------------------------------------------

/**
 * Calculates the CSS Grid position for a regional matchup.
 *
 * Only works for games within a region (R64, R32, S16, E8).
 * For Final Four and NCG games, use the FinalFour component's
 * own layout logic.
 *
 * @param gameId - The game identifier (e.g., "R64-East-3", "E8-South")
 * @param direction - "ltr" for left-to-right regions, "rtl" for right-to-left
 * @returns The CSS Grid position { gridRowStart, gridRowEnd, gridColumn }
 * @throws {Error} If the gameId is not a regional game
 */
export function getRegionMatchupPosition(
  gameId: string,
  direction: "ltr" | "rtl"
): GridPosition {
  const parsed = parseGameId(gameId);
  const { round } = parsed;

  if (!ROUND_COLUMNS[round]) {
    throw new Error(
      `getRegionMatchupPosition only handles regional games (R64/R32/S16/E8), got round "${round}"`
    );
  }

  const column = ROUND_COLUMNS[round][direction];
  const rowSpan = ROUND_ROW_SPAN[round];

  // Determine the game index (0-based) within the round for this region.
  // E8 always has 1 game per region (index 0).
  // For other rounds, gameNum is 1-based.
  let gameIndex: number;
  if (round === "E8") {
    gameIndex = 0;
  } else {
    const gameNum = parsed.gameNum;
    if (gameNum === undefined) {
      throw new Error(`Missing game number for ${gameId}`);
    }
    gameIndex = gameNum - 1;
  }

  // Row start is 1-based. Each game starts at (gameIndex * rowSpan) + 1.
  const gridRowStart = gameIndex * rowSpan + 1;
  const gridRowEnd = gridRowStart + rowSpan;

  return {
    gridRowStart,
    gridRowEnd,
    gridColumn: column,
  };
}

// ---------------------------------------------------------------------------
// Connector helpers
// ---------------------------------------------------------------------------

/**
 * Calculates the vertical midpoint (row) of a matchup's grid position.
 * Useful for drawing connector lines between rounds.
 *
 * @param position - The grid position of a matchup
 * @returns The midpoint row (may be fractional)
 */
export function getMatchupMidpoint(position: GridPosition): number {
  return (position.gridRowStart + position.gridRowEnd) / 2;
}
