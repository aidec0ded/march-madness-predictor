/**
 * Core team data types for the March Madness Bracket Predictor.
 *
 * These types represent the unified schema that all data sources
 * (KenPom, Torvik, Evan Miya) are normalized into. Every team
 * entering the tournament has one TeamSeason record per year,
 * containing all statistical fields used by the probability engine.
 */

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

/** NCAA conference identifiers */
export type Conference =
  | "ACC"
  | "Big 12"
  | "Big East"
  | "Big Ten"
  | "SEC"
  | "AAC"
  | "A-10"
  | "MWC"
  | "WCC"
  | "MVC"
  | "Pac-12"
  | "C-USA"
  | "MAC"
  | "Sun Belt"
  | "CAA"
  | "Horizon"
  | "Ivy"
  | "MAAC"
  | "OVC"
  | "Patriot"
  | "SoCon"
  | "Southland"
  | "Summit"
  | "WAC"
  | "Big Sky"
  | "Big South"
  | "Big West"
  | "MEAC"
  | "NEC"
  | "SWAC"
  | "AE"
  | "ASUN";

/** Tournament seed (1-16) */
export type Seed =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16;

/** Tournament regions */
export type Region = "East" | "West" | "South" | "Midwest";

/** Data source identifiers */
export type DataSource = "kenpom" | "torvik" | "evanmiya";

/** Tournament round identifiers */
export type TournamentRound =
  | "FF" // First Four (play-in)
  | "R64" // Round of 64
  | "R32" // Round of 32
  | "S16" // Sweet 16
  | "E8" // Elite 8
  | "F4" // Final Four
  | "NCG"; // National Championship Game

// ---------------------------------------------------------------------------
// Four Factors (offensive and defensive)
// ---------------------------------------------------------------------------

/** Dean Oliver's Four Factors — the core statistical profile of a team */
export interface FourFactors {
  /** Effective Field Goal % — adjusts FG% for the extra value of threes */
  efgPct: number;
  /** Turnover Rate — turnovers per possession */
  toPct: number;
  /** Offensive Rebound % — % of available offensive rebounds grabbed */
  orbPct: number;
  /** Free Throw Rate — FTA/FGA ratio, measures ability to get to the line */
  ftRate: number;
}

// ---------------------------------------------------------------------------
// Shooting splits
// ---------------------------------------------------------------------------

/** Shooting breakdown for a team (offensive or defensive) */
export interface ShootingSplits {
  /** Three-point field goal percentage */
  threePtPct: number;
  /** Three-point attempt rate — 3PA/FGA, measures reliance on threes */
  threePtRate: number;
  /** Free throw percentage */
  ftPct: number;
}

// ---------------------------------------------------------------------------
// Efficiency ratings (per source)
// ---------------------------------------------------------------------------

/**
 * Adjusted efficiency ratings from a single data source.
 * All efficiency values are per-100-possessions, adjusted for opponent strength.
 */
export interface EfficiencyRatings {
  /** Data source this rating comes from */
  source: DataSource;
  /** Adjusted Offensive Efficiency — points scored per 100 possessions */
  adjOE: number;
  /** Adjusted Defensive Efficiency — points allowed per 100 possessions */
  adjDE: number;
  /** Adjusted Efficiency Margin — adjOE - adjDE (or BPR for Evan Miya) */
  adjEM: number;
}

// ---------------------------------------------------------------------------
// Team metadata
// ---------------------------------------------------------------------------

/** Core team identity — stable across seasons */
export interface Team {
  id: string;
  /** Full team name (e.g., "Connecticut Huskies") */
  name: string;
  /** Short display name (e.g., "UConn") */
  shortName: string;
  /** NCAA conference */
  conference: Conference;
  /** Campus location for site proximity calculations */
  campus: {
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  };
}

// ---------------------------------------------------------------------------
// Coach data
// ---------------------------------------------------------------------------

/** Coach tournament history and experience */
export interface CoachRecord {
  /** Coach full name */
  name: string;
  /** Total NCAA tournament games coached */
  tournamentGames: number;
  /** Tournament wins */
  tournamentWins: number;
  /** Final Four appearances */
  finalFours: number;
  /** National championships */
  championships: number;
  /** Years as D-1 head coach */
  yearsHeadCoach: number;
}

// ---------------------------------------------------------------------------
// Tournament entry
// ---------------------------------------------------------------------------

/** A team's tournament-specific information for a given year */
export interface TournamentEntry {
  /** Tournament seed (1–16) */
  seed: Seed;
  /** Bracket region */
  region: Region;
  /** Bracket position within region (1–16, determines matchup path) */
  bracketPosition: number;
}

// ---------------------------------------------------------------------------
// Team season stats — the main data object
// ---------------------------------------------------------------------------

/**
 * Complete statistical profile for a team in a given season.
 * This is the primary data structure consumed by the probability engine.
 *
 * All stats are end-of-regular-season snapshots (pre-tournament).
 */
export interface TeamSeason {
  /** Unique identifier */
  id: string;
  /** Reference to the team */
  teamId: string;
  /** Season year (e.g., 2025 for the 2024-25 season) */
  season: number;

  // --- Team identity (denormalized for convenience) ---
  team: Team;

  // --- Efficiency ratings from each source ---
  ratings: {
    kenpom?: EfficiencyRatings;
    torvik?: EfficiencyRatings;
    evanmiya?: EfficiencyRatings;
  };

  // --- Four Factors (offensive and defensive) ---
  fourFactorsOffense: FourFactors;
  /** Null when defensive four-factors data has not been loaded. */
  fourFactorsDefense: FourFactors | null;

  // --- Shooting splits (offensive and defensive) ---
  shootingOffense: ShootingSplits;
  /** Null when defensive shooting data has not been loaded. */
  shootingDefense: ShootingSplits | null;

  // --- Tempo & Pace ---
  /** Adjusted tempo — possessions per 40 minutes, adjusted for opponent */
  adjTempo: number;
  /** Average offensive possession length (seconds) */
  avgPossLengthOff: number;
  /** Average defensive possession length (seconds) */
  avgPossLengthDef: number;

  // --- Roster & Experience ---
  /** Bench minutes % — share of minutes played by non-starters */
  benchMinutesPct: number;
  /** D-1 Experience — KenPom minutes-weighted years of D-1 experience */
  experience: number;
  /** Minutes continuity — % of minutes returning from prior season */
  minutesContinuity: number;
  /** Average height (inches) */
  avgHeight: number;

  // --- Coaching & Style ---
  /** 2-Foul Participation — tendency to keep players in with 2 fouls */
  twoFoulParticipation: number;

  // --- Schedule & Luck (KenPom) ---
  /** Strength of Schedule — average opponent net efficiency rating */
  sosNetRating: number;
  /** Offensive SoS — average opponent offensive efficiency */
  sosOffRating: number;
  /** Defensive SoS — average opponent defensive efficiency */
  sosDefRating: number;
  /** Luck — per-game over/underperformance vs efficiency (positive = overperformed) */
  luck: number;

  // --- Evan Miya-specific metrics ---
  /** Opponent Adjustment — how well team plays up/down to competition (positive = plays UP) */
  evanmiyaOpponentAdjust: number;
  /** Pace Adjustment — how well team performs in fast vs slow games (positive = better in fast games) */
  evanmiyaPaceAdjust: number;
  /** Kill Shots Per Game — 10-0 scoring runs made per game */
  evanmiyaKillShotsPerGame: number;
  /** Kill Shots Allowed Per Game — 10-0 scoring runs conceded per game */
  evanmiyaKillShotsAllowedPerGame: number;
  /** Kill Shots Margin — kill shots made minus allowed per game */
  evanmiyaKillShotsMargin: number;

  /** Coach record */
  coach: CoachRecord;

  // --- Tournament-specific ---
  tournamentEntry?: TournamentEntry;

  // --- Metadata ---
  /** When this record was last updated */
  updatedAt: string;
  /** Which data sources have been loaded for this team */
  dataSources: DataSource[];
}

// ---------------------------------------------------------------------------
// Tournament site (for site proximity calculations)
// ---------------------------------------------------------------------------

/** A physical venue hosting tournament games */
export interface TournamentSite {
  id: string;
  /** Venue name (e.g., "State Farm Arena") */
  name: string;
  /** City */
  city: string;
  /** State */
  state: string;
  /** Latitude for distance calculations */
  latitude: number;
  /** Longitude for distance calculations */
  longitude: number;
  /** Which rounds are played here */
  rounds: TournamentRound[];
  /** Which region(s) play here (for regionals) */
  regions?: Region[];
  /**
   * Which seed lines play at this venue for R64/R32.
   * E.g., [1, 16, 8, 9] means the 1v16 and 8v9 games are here.
   * Undefined/null means all games for this round/region (S16/E8/F4/NCG).
   */
  seedMatchups?: number[];
  /** Tournament year */
  season: number;
}

/** Distance bucketing for site proximity lever */
export type SiteProximityBucket =
  | "true_home" // < 50 miles from campus
  | "regional_advantage" // 50–200 miles
  | "neutral" // 200–500 miles
  | "moderate_travel" // 500–1000 miles
  | "significant_travel"; // 1000+ miles
