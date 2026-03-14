import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SITE_NAME } from "@/lib/constants";
import { BracketShell } from "./BracketShell";
import { createStrongTeam, createWeakTeam } from "@/lib/engine/test-helpers";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// Mock heavy dependencies that BracketShell children rely on
// ---------------------------------------------------------------------------

// Mock useBracketSimulation (used by SimulationButton)
vi.mock("@/hooks/useBracketSimulation", () => ({
  useBracketSimulation: () => ({
    simulate: vi.fn().mockResolvedValue({}),
    isSimulating: false,
    simulationResult: null,
  }),
}));

// Mock useContestStrategy (used by BracketGrid)
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
    getRecommendation: () => ({
      type: "neutral",
      leverageScore: 1,
      reason: "test",
    }),
  }),
}));

// Mock useGuidance (used by GuidancePanel)
vi.mock("@/hooks/useGuidance", () => ({
  useGuidance: () => [],
}));

// Mock useBracketPersistence (used by SaveButton)
vi.mock("@/hooks/useBracketPersistence", () => ({
  useBracketPersistence: () => ({
    saveBracket: vi.fn().mockResolvedValue(undefined),
    isDirty: false,
    isAuthenticated: false,
  }),
}));

// Mock next/dynamic to avoid dynamic import issues in test
vi.mock("next/dynamic", () => ({
  default: () => {
    // Return a component that renders nothing
    return function MockDynamicComponent() {
      return null;
    };
  },
}));

// Mock bracket-layout (used by RegionBracket)
vi.mock("@/lib/bracket-layout", () => ({
  getRegionMatchupPosition: (gameId: string, direction: string) => ({
    gridRowStart: 1,
    gridRowEnd: 2,
    gridColumn: 1,
  }),
  getConnectorColumn: (targetRound: string, direction: string) => 2,
  parseGameId: (gameId: string) => {
    const parts = gameId.split("-");
    return {
      round: parts[0] || "R64",
      region: parts[1] || "East",
      gameNum: parseInt(parts[2]) || 1,
    };
  },
}));

// Mock bracket-utils (used by RegionBracket and BracketProvider)
vi.mock("@/lib/bracket-utils", () => ({
  resolveMatchupTeams: () => ({ teamA: null, teamB: null }),
  resolveSlotTeam: () => null,
  isGameId: (source: string) => /^(FF|R64|R32|S16|E8|F4|NCG)-/.test(source),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const initialTeams: TeamSeason[] = [team1, team2];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BracketShell", () => {
  it("renders the bracket header with title", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText(SITE_NAME)).toBeInTheDocument();
  });

  it("renders the Pool size selector", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("Pool")).toBeInTheDocument();
  });

  it("renders the Simulation button", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("Run Simulation")).toBeInTheDocument();
  });

  it("renders the Results toggle button", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("Results")).toBeInTheDocument();
  });

  it("renders the Guide toggle button", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("Guide")).toBeInTheDocument();
  });

  it("renders the Levers toggle button", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("Levers")).toBeInTheDocument();
  });

  it("renders the Save button", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("toggles the Guidance panel when Guide button is clicked", async () => {
    const user = userEvent.setup();
    render(<BracketShell initialTeams={initialTeams} />);

    // Guidance panel should not be open initially
    expect(screen.queryByLabelText("Close guidance panel")).toBeNull();

    // Click Guide button
    await user.click(screen.getByText("Guide"));

    // Now the guidance panel should be open
    expect(
      screen.getByLabelText("Close guidance panel")
    ).toBeInTheDocument();
  });

  it("toggles the Guide button aria-pressed state", async () => {
    const user = userEvent.setup();
    render(<BracketShell initialTeams={initialTeams} />);

    const guideBtn = screen.getByText("Guide");
    expect(guideBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(guideBtn);
    expect(guideBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(guideBtn);
    expect(guideBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the main bracket area", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders four region headers", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("East")).toBeInTheDocument();
    expect(screen.getByText("South")).toBeInTheDocument();
    expect(screen.getByText("West")).toBeInTheDocument();
    expect(screen.getByText("Midwest")).toBeInTheDocument();
  });

  it("renders the Final Four section", () => {
    render(<BracketShell initialTeams={initialTeams} />);
    expect(screen.getByText("Final Four")).toBeInTheDocument();
  });
});
