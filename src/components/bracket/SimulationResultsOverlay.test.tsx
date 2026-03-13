import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SimulationResultsOverlay } from "./SimulationResultsOverlay";
import type { SimulationResult } from "@/types/simulation";
import type { TeamSeason } from "@/types/team";
import { createStrongTeam, createMidTeam } from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// Mock useBracket hook
// ---------------------------------------------------------------------------

const champTeam = createStrongTeam({
  teamId: "duke",
  team: {
    id: "duke",
    name: "Duke Blue Devils",
    shortName: "Duke",
    conference: "ACC",
    campus: { city: "Durham", state: "NC", latitude: 36, longitude: -79 },
  },
  tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
});

const runnerUp = createMidTeam({
  teamId: "marquette",
  team: {
    id: "marquette",
    name: "Marquette Golden Eagles",
    shortName: "Marquette",
    conference: "Big East",
    campus: { city: "Milwaukee", state: "WI", latitude: 43, longitude: -88 },
  },
  tournamentEntry: { seed: 4, region: "West", bracketPosition: 4 },
});

const teamsMap = new Map<string, TeamSeason>([
  ["duke", champTeam],
  ["marquette", runnerUp],
]);

const mockSimResult: SimulationResult = {
  teamResults: [
    {
      teamId: "duke",
      seed: 1,
      region: "East",
      roundProbabilities: {
        FF: 1,
        R64: 0.98,
        R32: 0.92,
        S16: 0.78,
        E8: 0.62,
        F4: 0.42,
        NCG: 0.25,
      },
      championshipProbability: 0.15,
      expectedWins: 4.2,
    },
    {
      teamId: "marquette",
      seed: 4,
      region: "West",
      roundProbabilities: {
        FF: 1,
        R64: 0.82,
        R32: 0.58,
        S16: 0.35,
        E8: 0.18,
        F4: 0.08,
        NCG: 0.03,
      },
      championshipProbability: 0.03,
      expectedWins: 2.1,
    },
  ],
  numSimulations: 10000,
  mostLikelyChampion: { teamId: "duke", probability: 0.15 },
  topChampions: [
    { teamId: "duke", probability: 0.15 },
    { teamId: "marquette", probability: 0.03 },
  ],
  executionTimeMs: 450,
  upsetRates: {
    FF: 0,
    R64: 0.22,
    R32: 0.31,
    S16: 0.37,
    E8: 0.42,
    F4: 0.48,
    NCG: 0.5,
  },
};

let mockState: {
  simulationResult: SimulationResult | null;
  teams: Map<string, TeamSeason>;
  isSimulationStale: boolean;
};

vi.mock("@/hooks/useBracket", () => ({
  useBracket: () => ({
    state: mockState,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SimulationResultsOverlay", () => {
  beforeEach(() => {
    mockState = {
      simulationResult: mockSimResult,
      teams: teamsMap,
      isSimulationStale: false,
    };
  });

  describe("visibility", () => {
    it("returns null when isOpen is false", () => {
      const { container } = render(
        <SimulationResultsOverlay isOpen={false} onClose={() => {}} />
      );
      expect(container.firstElementChild).toBeNull();
    });

    it("returns null when isOpen is true but no simulation result", () => {
      mockState.simulationResult = null;
      const { container } = render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(container.firstElementChild).toBeNull();
    });

    it("renders content when isOpen is true and simulation result exists", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByText("Simulation Results")).toBeInTheDocument();
    });
  });

  describe("champion display", () => {
    it("shows 'Most Likely Champion' heading", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(
        screen.getByText("Most Likely Champion")
      ).toBeInTheDocument();
    });

    it("shows the champion team name", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      // Champion name appears in both the champion section and the top-10 table
      const elements = screen.getAllByText("Duke Blue Devils");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it("shows the champion probability", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      // 15.0% appears in both the champion section and the top-10 table
      const elements = screen.getAllByText("15.0%");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it("shows the champion seed badge", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      // Seed badge renders as "1" inside a styled span
      const seedBadges = screen.getAllByText("1");
      expect(seedBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("top champions table", () => {
    it("shows 'Top 10 Championship Contenders' heading", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(
        screen.getByText("Top 10 Championship Contenders")
      ).toBeInTheDocument();
    });

    it("renders champion entries in the table", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      // Duke appears in both champion section and table, so use getAllByText
      const dukeElements = screen.getAllByText("Duke Blue Devils");
      expect(dukeElements.length).toBeGreaterThanOrEqual(2); // champion + table
      expect(
        screen.getByText("Marquette Golden Eagles")
      ).toBeInTheDocument();
    });

    it("shows probability for each team in the table", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      // 15.0% appears in both the champion section and the table
      const prob15 = screen.getAllByText("15.0%");
      expect(prob15.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("3.0%")).toBeInTheDocument();
    });
  });

  describe("upset rates", () => {
    it("shows 'Upset Rates by Round' heading", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(
        screen.getByText("Upset Rates by Round")
      ).toBeInTheDocument();
    });

    it("shows round labels", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByText("Round of 64")).toBeInTheDocument();
      expect(screen.getByText("Sweet 16")).toBeInTheDocument();
      expect(screen.getByText("Championship")).toBeInTheDocument();
    });

    it("shows upset rate percentages", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByText("22.0%")).toBeInTheDocument();
    });
  });

  describe("simulation metadata", () => {
    it("shows simulation count", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByText("10,000")).toBeInTheDocument();
    });

    it("shows execution time in milliseconds for < 1s", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByText("450ms")).toBeInTheDocument();
    });

    it("shows execution time in seconds for >= 1s", () => {
      mockState.simulationResult = {
        ...mockSimResult,
        executionTimeMs: 2500,
      };
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByText("2.5s")).toBeInTheDocument();
    });
  });

  describe("explanatory header", () => {
    it("shows the explanatory subtitle with simulation count", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      const subtitle = screen.getByText(/full-bracket/i);
      expect(subtitle).toBeInTheDocument();
      expect(subtitle.textContent).toContain("10,000");
    });

    it("mentions lever settings in the subtitle", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByText(/lever settings/i)).toBeInTheDocument();
    });
  });

  describe("stale results banner", () => {
    it("shows stale banner when isSimulationStale is true", () => {
      mockState.isSimulationStale = true;
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(
        screen.getByText(/results may be outdated/i)
      ).toBeInTheDocument();
    });

    it("does not show stale banner when isSimulationStale is false", () => {
      mockState.isSimulationStale = false;
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(
        screen.queryByText(/results may be outdated/i)
      ).not.toBeInTheDocument();
    });

    it("stale banner mentions re-running simulation", () => {
      mockState.isSimulationStale = true;
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(
        screen.getByText(/re-run simulation/i)
      ).toBeInTheDocument();
    });
  });

  describe("close button", () => {
    it("renders a close button", () => {
      render(
        <SimulationResultsOverlay isOpen={true} onClose={() => {}} />
      );
      expect(screen.getByLabelText("Close results")).toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <SimulationResultsOverlay isOpen={true} onClose={handleClose} />
      );
      await user.click(screen.getByLabelText("Close results"));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
