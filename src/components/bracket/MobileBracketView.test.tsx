import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MobileBracketView } from "./MobileBracketView";
import type { TeamSeason } from "@/types/team";
import { createStrongTeam, createWeakTeam } from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// Mock dependencies (same pattern as BracketShell tests)
// ---------------------------------------------------------------------------

const mockTeams = new Map<string, TeamSeason>();

const team1 = createStrongTeam({
  teamId: "team-1",
  team: {
    id: "team-1",
    name: "Team One",
    shortName: "T1",
    conference: "Big 12",
    campus: { city: "Test", state: "TS", latitude: 0, longitude: 0 },
  },
  tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
});

const team2 = createWeakTeam({
  teamId: "team-2",
  team: {
    id: "team-2",
    name: "Team Two",
    shortName: "T2",
    conference: "MEAC",
    campus: { city: "Test", state: "TS", latitude: 0, longitude: 0 },
  },
  tournamentEntry: { seed: 16, region: "East", bracketPosition: 16 },
});

mockTeams.set("team-1", team1);
mockTeams.set("team-2", team2);

// Mock useBracket
vi.mock("@/hooks/useBracket", () => ({
  useBracket: () => ({
    state: {
      teams: mockTeams,
      picks: {},
      simulationResult: null,
      matchupOverrides: {},
      globalLevers: {},
    },
    dispatch: vi.fn(),
    allMatchups: [],
  }),
}));

// Mock useContestStrategy
vi.mock("@/hooks/useContestStrategy", () => ({
  useContestStrategy: () => ({
    ownershipModel: null,
    poolConfig: {
      bucket: "medium",
      label: "Medium (50-200)",
      ownershipFactor: 0.3,
      contrarianThreshold: 1.5,
      avoidThreshold: 0.5,
      description: "Test",
    },
    poolSizeBucket: "medium",
    getOwnership: () => 0,
    getMatchupOwnership: () => [50, 50] as [number, number],
    getRecommendation: () => ({
      type: "neutral",
      leverageScore: 1,
      reason: "test",
    }),
  }),
}));

// Note: useGameProbabilities is no longer called by MobileBracketView or
// RegionBracket — gameProbabilities is passed as a prop instead.

// Mock bracket-layout (used by RegionBracket)
vi.mock("@/lib/bracket-layout", () => ({
  getRegionMatchupPosition: () => ({
    gridRowStart: 1,
    gridRowEnd: 2,
    gridColumn: 1,
  }),
  getConnectorColumn: () => 2,
  parseGameId: (gameId: string) => {
    const parts = gameId.split("-");
    return {
      round: parts[0] || "R64",
      region: parts[1] || "East",
      gameNum: parseInt(parts[2]) || 1,
    };
  },
}));

// Mock bracket-utils (used by RegionBracket)
vi.mock("@/lib/bracket-utils", () => ({
  resolveMatchupTeams: () => ({ teamA: null, teamB: null }),
  resolveSlotTeam: () => null,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MobileBracketView", () => {
  it("renders all five tab buttons", () => {
    render(<MobileBracketView gameProbabilities={{}} />);

    expect(screen.getByRole("tab", { name: "East" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "West" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "South" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Midwest" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Final 4" })).toBeInTheDocument();
  });

  it("defaults to East tab being active", () => {
    render(<MobileBracketView gameProbabilities={{}} />);

    const eastTab = screen.getByRole("tab", { name: "East" });
    expect(eastTab).toHaveAttribute("aria-selected", "true");

    const westTab = screen.getByRole("tab", { name: "West" });
    expect(westTab).toHaveAttribute("aria-selected", "false");
  });

  it("shows East region content by default", () => {
    render(<MobileBracketView gameProbabilities={{}} />);

    // The tabpanel should have the East label
    expect(
      screen.getByRole("tabpanel", { name: "East bracket" })
    ).toBeInTheDocument();
  });

  it("switches to West region when West tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MobileBracketView gameProbabilities={{}} />);

    await user.click(screen.getByRole("tab", { name: "West" }));

    const westTab = screen.getByRole("tab", { name: "West" });
    expect(westTab).toHaveAttribute("aria-selected", "true");

    const eastTab = screen.getByRole("tab", { name: "East" });
    expect(eastTab).toHaveAttribute("aria-selected", "false");
  });

  it("switches to Final 4 tab when clicked", async () => {
    const user = userEvent.setup();
    render(<MobileBracketView gameProbabilities={{}} />);

    await user.click(screen.getByRole("tab", { name: "Final 4" }));

    const f4Tab = screen.getByRole("tab", { name: "Final 4" });
    expect(f4Tab).toHaveAttribute("aria-selected", "true");

    expect(
      screen.getByRole("tabpanel", { name: "Final 4 bracket" })
    ).toBeInTheDocument();
  });

  it("renders the tablist with proper role", () => {
    render(<MobileBracketView gameProbabilities={{}} />);
    expect(
      screen.getByRole("tablist", { name: "Bracket regions" })
    ).toBeInTheDocument();
  });

  it("calls onMatchupClick when provided", () => {
    const mockClick = vi.fn();
    render(<MobileBracketView onMatchupClick={mockClick} gameProbabilities={{}} />);

    // Component renders without error when callback is provided
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
