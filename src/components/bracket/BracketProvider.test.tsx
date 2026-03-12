import { render, screen, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useContext } from "react";
import {
  BracketProvider,
  BracketContext,
  type BracketContextValue,
} from "./BracketProvider";
import { createStrongTeam, createWeakTeam } from "@/lib/engine/test-helpers";
import { DEFAULT_GLOBAL_LEVERS } from "@/types/engine";
import type { BracketAction } from "@/types/bracket-ui";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const team1 = createStrongTeam({
  teamId: "team-a",
  team: {
    id: "team-a",
    name: "Team Alpha",
    shortName: "ALPHA",
    conference: "Big 12",
    campus: { city: "Test", state: "TS", latitude: 0, longitude: 0 },
  },
  tournamentEntry: { seed: 1, region: "East", bracketPosition: 1 },
});

const team16 = createWeakTeam({
  teamId: "team-b",
  team: {
    id: "team-b",
    name: "Team Beta",
    shortName: "BETA",
    conference: "MEAC",
    campus: { city: "Test", state: "TS", latitude: 0, longitude: 0 },
  },
  tournamentEntry: { seed: 16, region: "East", bracketPosition: 16 },
});

const initialTeams = [team1, team16];

// ---------------------------------------------------------------------------
// Test helper: component that renders state and exposes dispatch
// ---------------------------------------------------------------------------

let capturedValue: BracketContextValue | null = null;

function TestConsumer() {
  const value = useContext(BracketContext);
  capturedValue = value;
  if (!value) return <div>No context</div>;

  return (
    <div>
      <div data-testid="teams-count">{value.state.teams.size}</div>
      <div data-testid="pool-size">{value.state.poolSizeBucket}</div>
      <div data-testid="is-dirty">{String(value.state.isDirty)}</div>
      <div data-testid="bracket-name">{value.state.bracketName}</div>
      <div data-testid="picks">{JSON.stringify(value.state.picks)}</div>
      <div data-testid="is-simulating">
        {String(value.state.isSimulating)}
      </div>
    </div>
  );
}

function renderWithProvider(teams = initialTeams) {
  capturedValue = null;
  return render(
    <BracketProvider initialTeams={teams}>
      <TestConsumer />
    </BracketProvider>
  );
}

function dispatch(action: BracketAction) {
  act(() => {
    capturedValue?.dispatch(action);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BracketProvider", () => {
  describe("initial state", () => {
    it("provides context to children", () => {
      renderWithProvider();
      expect(capturedValue).not.toBeNull();
    });

    it("initializes teams Map from initialTeams array", () => {
      renderWithProvider();
      expect(screen.getByTestId("teams-count").textContent).toBe("2");
    });

    it("initializes with empty picks", () => {
      renderWithProvider();
      expect(screen.getByTestId("picks").textContent).toBe("{}");
    });

    it("initializes with medium pool size", () => {
      renderWithProvider();
      expect(screen.getByTestId("pool-size").textContent).toBe("medium");
    });

    it("initializes isDirty as false", () => {
      renderWithProvider();
      expect(screen.getByTestId("is-dirty").textContent).toBe("false");
    });

    it("initializes bracketName as 'My Bracket'", () => {
      renderWithProvider();
      expect(screen.getByTestId("bracket-name").textContent).toBe(
        "My Bracket"
      );
    });

    it("initializes isSimulating as false", () => {
      renderWithProvider();
      expect(screen.getByTestId("is-simulating").textContent).toBe(
        "false"
      );
    });
  });

  describe("ADVANCE_TEAM action", () => {
    it("sets a pick for a game", () => {
      renderWithProvider();
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      expect(capturedValue!.state.picks["R64-East-1"]).toBe("team-a");
    });

    it("marks state as dirty", () => {
      renderWithProvider();
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      expect(capturedValue!.state.isDirty).toBe(true);
    });

    it("replaces an existing pick", () => {
      renderWithProvider();
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-b",
      });
      expect(capturedValue!.state.picks["R64-East-1"]).toBe("team-b");
    });
  });

  describe("RESET_PICK action", () => {
    it("removes a pick for a game", () => {
      renderWithProvider();
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      dispatch({ type: "RESET_PICK", gameId: "R64-East-1" });
      expect(capturedValue!.state.picks["R64-East-1"]).toBeUndefined();
    });

    it("marks state as dirty", () => {
      renderWithProvider();
      dispatch({ type: "RESET_PICK", gameId: "R64-East-1" });
      expect(capturedValue!.state.isDirty).toBe(true);
    });
  });

  describe("SET_GLOBAL_LEVERS action", () => {
    it("merges partial lever updates", () => {
      renderWithProvider();
      dispatch({
        type: "SET_GLOBAL_LEVERS",
        levers: { experienceWeight: 2.5 },
      });
      expect(capturedValue!.state.globalLevers.experienceWeight).toBe(2.5);
      // Other levers remain unchanged
      expect(capturedValue!.state.globalLevers.continuityWeight).toBe(
        DEFAULT_GLOBAL_LEVERS.continuityWeight
      );
    });

    it("marks state as dirty", () => {
      renderWithProvider();
      dispatch({
        type: "SET_GLOBAL_LEVERS",
        levers: { experienceWeight: 2.5 },
      });
      expect(capturedValue!.state.isDirty).toBe(true);
    });
  });

  describe("SET_MATCHUP_OVERRIDE action", () => {
    it("sets overrides for a specific game", () => {
      renderWithProvider();
      dispatch({
        type: "SET_MATCHUP_OVERRIDE",
        gameId: "R64-East-1",
        overrides: { injuryAdjustmentA: -3.0 },
      });
      expect(
        capturedValue!.state.matchupOverrides["R64-East-1"]
          ?.injuryAdjustmentA
      ).toBe(-3.0);
    });

    it("marks state as dirty", () => {
      renderWithProvider();
      dispatch({
        type: "SET_MATCHUP_OVERRIDE",
        gameId: "R64-East-1",
        overrides: { injuryAdjustmentA: -3.0 },
      });
      expect(capturedValue!.state.isDirty).toBe(true);
    });
  });

  describe("REMOVE_MATCHUP_OVERRIDE action", () => {
    it("removes overrides for a specific game", () => {
      renderWithProvider();
      dispatch({
        type: "SET_MATCHUP_OVERRIDE",
        gameId: "R64-East-1",
        overrides: { injuryAdjustmentA: -3.0 },
      });
      dispatch({
        type: "REMOVE_MATCHUP_OVERRIDE",
        gameId: "R64-East-1",
      });
      expect(
        capturedValue!.state.matchupOverrides["R64-East-1"]
      ).toBeUndefined();
    });
  });

  describe("SET_SIMULATION_RESULT action", () => {
    it("stores the simulation result and clears isSimulating", () => {
      renderWithProvider();
      dispatch({ type: "SET_SIMULATING", isSimulating: true });
      expect(capturedValue!.state.isSimulating).toBe(true);

      const mockResult = {
        teamResults: [],
        numSimulations: 10000,
        mostLikelyChampion: { teamId: "team-a", probability: 0.15 },
        topChampions: [],
        executionTimeMs: 500,
        upsetRates: {} as Record<string, number>,
      } as any;

      dispatch({ type: "SET_SIMULATION_RESULT", result: mockResult });
      expect(capturedValue!.state.simulationResult).toBe(mockResult);
      expect(capturedValue!.state.isSimulating).toBe(false);
    });
  });

  describe("SET_SIMULATING action", () => {
    it("toggles the isSimulating flag", () => {
      renderWithProvider();
      dispatch({ type: "SET_SIMULATING", isSimulating: true });
      expect(capturedValue!.state.isSimulating).toBe(true);
      dispatch({ type: "SET_SIMULATING", isSimulating: false });
      expect(capturedValue!.state.isSimulating).toBe(false);
    });
  });

  describe("CLEAR_BRACKET action", () => {
    it("resets all state to defaults", () => {
      renderWithProvider();
      // Make some changes
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      dispatch({
        type: "SET_GLOBAL_LEVERS",
        levers: { experienceWeight: 3.0 },
      });
      dispatch({
        type: "SET_POOL_SIZE",
        poolSizeBucket: "large",
      });

      // Clear
      dispatch({ type: "CLEAR_BRACKET" });

      expect(Object.keys(capturedValue!.state.picks)).toHaveLength(0);
      expect(capturedValue!.state.globalLevers.experienceWeight).toBe(
        DEFAULT_GLOBAL_LEVERS.experienceWeight
      );
      expect(capturedValue!.state.poolSizeBucket).toBe("medium");
      expect(capturedValue!.state.isDirty).toBe(false);
      expect(capturedValue!.state.bracketName).toBe("My Bracket");
    });
  });

  describe("SET_POOL_SIZE action", () => {
    it("updates the pool size bucket", () => {
      renderWithProvider();
      dispatch({ type: "SET_POOL_SIZE", poolSizeBucket: "very_large" });
      expect(capturedValue!.state.poolSizeBucket).toBe("very_large");
    });

    it("marks state as dirty", () => {
      renderWithProvider();
      dispatch({ type: "SET_POOL_SIZE", poolSizeBucket: "small" });
      expect(capturedValue!.state.isDirty).toBe(true);
    });
  });

  describe("MARK_SAVED action", () => {
    it("sets bracketId and clears dirty flag", () => {
      renderWithProvider();
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      expect(capturedValue!.state.isDirty).toBe(true);

      dispatch({ type: "MARK_SAVED", bracketId: "saved-bracket-123" });
      expect(capturedValue!.state.bracketId).toBe("saved-bracket-123");
      expect(capturedValue!.state.isDirty).toBe(false);
    });
  });

  describe("LOAD_BRACKET action", () => {
    it("restores saved bracket data", () => {
      renderWithProvider();
      const savedBracket = {
        bracketId: "bracket-456",
        name: "Championship Bracket",
        picks: { "R64-East-1": "team-a" },
        globalLevers: {
          ...DEFAULT_GLOBAL_LEVERS,
          experienceWeight: 2.0,
        },
        matchupOverrides: {},
        simulationSnapshot: null,
      };

      dispatch({ type: "LOAD_BRACKET", bracket: savedBracket });

      expect(capturedValue!.state.bracketId).toBe("bracket-456");
      expect(capturedValue!.state.bracketName).toBe("Championship Bracket");
      expect(capturedValue!.state.picks["R64-East-1"]).toBe("team-a");
      expect(capturedValue!.state.globalLevers.experienceWeight).toBe(2.0);
      expect(capturedValue!.state.isDirty).toBe(false);
    });
  });

  describe("saved bracket initialization", () => {
    it("restores picks from savedBracket prop", () => {
      capturedValue = null;
      render(
        <BracketProvider
          initialTeams={initialTeams}
          savedBracket={{
            bracketId: "sb-1",
            name: "Saved One",
            picks: { "R64-East-1": "team-a" },
            globalLevers: DEFAULT_GLOBAL_LEVERS,
            matchupOverrides: {},
            simulationSnapshot: null,
          }}
        >
          <TestConsumer />
        </BracketProvider>
      );

      expect(capturedValue!.state.picks["R64-East-1"]).toBe("team-a");
      expect(capturedValue!.state.bracketId).toBe("sb-1");
      expect(capturedValue!.state.bracketName).toBe("Saved One");
    });
  });

  describe("simulation staleness", () => {
    const mockResult = {
      teamResults: [],
      numSimulations: 10000,
      mostLikelyChampion: { teamId: "team-a", probability: 0.15 },
      topChampions: [],
      executionTimeMs: 500,
      upsetRates: {} as Record<string, number>,
    } as any;

    it("initializes isSimulationStale as false", () => {
      renderWithProvider();
      expect(capturedValue!.state.isSimulationStale).toBe(false);
    });

    it("initializes simulationInputHash as null", () => {
      renderWithProvider();
      expect(capturedValue!.state.simulationInputHash).toBeNull();
    });

    it("sets isSimulationStale to false after SET_SIMULATION_RESULT", () => {
      renderWithProvider();
      dispatch({ type: "SET_SIMULATION_RESULT", result: mockResult });
      expect(capturedValue!.state.isSimulationStale).toBe(false);
      expect(capturedValue!.state.simulationInputHash).not.toBeNull();
    });

    it("becomes stale after ADVANCE_TEAM following a simulation", () => {
      renderWithProvider();
      dispatch({ type: "SET_SIMULATION_RESULT", result: mockResult });
      expect(capturedValue!.state.isSimulationStale).toBe(false);

      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      expect(capturedValue!.state.isSimulationStale).toBe(true);
    });

    it("becomes stale after SET_GLOBAL_LEVERS following a simulation", () => {
      renderWithProvider();
      dispatch({ type: "SET_SIMULATION_RESULT", result: mockResult });

      dispatch({
        type: "SET_GLOBAL_LEVERS",
        levers: { experienceWeight: 5.0 },
      });
      expect(capturedValue!.state.isSimulationStale).toBe(true);
    });

    it("becomes stale after SET_MATCHUP_OVERRIDE following a simulation", () => {
      renderWithProvider();
      dispatch({ type: "SET_SIMULATION_RESULT", result: mockResult });

      dispatch({
        type: "SET_MATCHUP_OVERRIDE",
        gameId: "R64-East-1",
        overrides: { injuryAdjustmentA: -2.0 },
      });
      expect(capturedValue!.state.isSimulationStale).toBe(true);
    });

    it("reverts to not stale when change is undone (hash match)", () => {
      renderWithProvider();
      // Run simulation with no picks
      dispatch({ type: "SET_SIMULATION_RESULT", result: mockResult });
      expect(capturedValue!.state.isSimulationStale).toBe(false);

      // Make a pick → stale
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      expect(capturedValue!.state.isSimulationStale).toBe(true);

      // Undo the pick → back to matching state → not stale
      dispatch({ type: "RESET_PICK", gameId: "R64-East-1" });
      expect(capturedValue!.state.isSimulationStale).toBe(false);
    });

    it("does not mark stale when no simulation has been run", () => {
      renderWithProvider();
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      expect(capturedValue!.state.isSimulationStale).toBe(false);
      expect(capturedValue!.state.simulationInputHash).toBeNull();
    });

    it("resets staleness on CLEAR_BRACKET", () => {
      renderWithProvider();
      dispatch({ type: "SET_SIMULATION_RESULT", result: mockResult });
      dispatch({
        type: "ADVANCE_TEAM",
        gameId: "R64-East-1",
        teamId: "team-a",
      });
      expect(capturedValue!.state.isSimulationStale).toBe(true);

      dispatch({ type: "CLEAR_BRACKET" });
      expect(capturedValue!.state.isSimulationStale).toBe(false);
      expect(capturedValue!.state.simulationInputHash).toBeNull();
    });
  });
});
