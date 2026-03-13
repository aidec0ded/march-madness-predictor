import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FirstFour } from "./FirstFour";
import {
  createStrongTeam,
  createWeakTeam,
  createMidTeam,
} from "@/lib/engine/test-helpers";
import type { BracketMatchup, PlayInConfig } from "@/types/simulation";
import type { TeamSeason } from "@/types/team";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const teamAEast16 = createWeakTeam({
  teamId: "team-a",
  team: {
    id: "team-a",
    name: "Team A Knights",
    shortName: "Team A",
    conference: "MEAC",
    campus: { city: "A City", state: "VA", latitude: 37, longitude: -77 },
  },
  tournamentEntry: { seed: 16, region: "East", bracketPosition: 16 },
});

const teamBEast16 = createWeakTeam({
  teamId: "team-b",
  team: {
    id: "team-b",
    name: "Team B Wildcats",
    shortName: "Team B",
    conference: "SWAC",
    campus: { city: "B City", state: "AL", latitude: 33, longitude: -87 },
  },
  tournamentEntry: { seed: 16, region: "East", bracketPosition: 16 },
});

const teamCSouth11 = createMidTeam({
  teamId: "team-c",
  team: {
    id: "team-c",
    name: "Team C Bears",
    shortName: "Team C",
    conference: "MVC",
    campus: { city: "C City", state: "MO", latitude: 38, longitude: -90 },
  },
  tournamentEntry: { seed: 11, region: "South", bracketPosition: 11 },
});

const teamDSouth11 = createMidTeam({
  teamId: "team-d",
  team: {
    id: "team-d",
    name: "Team D Bulldogs",
    shortName: "Team D",
    conference: "WCC",
    campus: { city: "D City", state: "CA", latitude: 34, longitude: -118 },
  },
  tournamentEntry: { seed: 11, region: "South", bracketPosition: 11 },
});

const playInConfig: PlayInConfig = {
  matchups: [
    { region: "East", seed: 16, teamAId: "team-a", teamBId: "team-b" },
    { region: "South", seed: 11, teamAId: "team-c", teamBId: "team-d" },
  ],
};

const ffMatchups: BracketMatchup[] = [
  {
    gameId: "FF-East-16",
    round: "FF",
    region: "East",
    teamASource: "FF-East-16-A",
    teamBSource: "FF-East-16-B",
  },
  {
    gameId: "FF-South-11",
    round: "FF",
    region: "South",
    teamASource: "FF-South-11-A",
    teamBSource: "FF-South-11-B",
  },
];

function buildTeamsMap(): Map<string, TeamSeason> {
  const map = new Map<string, TeamSeason>();
  map.set("team-a", teamAEast16);
  map.set("team-b", teamBEast16);
  map.set("team-c", teamCSouth11);
  map.set("team-d", teamDSouth11);
  return map;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FirstFour", () => {
  it("renders the First Four header", () => {
    render(
      <FirstFour
        matchups={ffMatchups}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        playInConfig={playInConfig}
      />
    );
    expect(screen.getByText("First Four")).toBeInTheDocument();
  });

  it("renders all 4 team names from the play-in matchups", () => {
    render(
      <FirstFour
        matchups={ffMatchups}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        playInConfig={playInConfig}
      />
    );
    expect(screen.getByText("Team A")).toBeInTheDocument();
    expect(screen.getByText("Team B")).toBeInTheDocument();
    expect(screen.getByText("Team C")).toBeInTheDocument();
    expect(screen.getByText("Team D")).toBeInTheDocument();
  });

  it("renders region and seed labels for each matchup", () => {
    render(
      <FirstFour
        matchups={ffMatchups}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        playInConfig={playInConfig}
      />
    );
    expect(screen.getByText("East 16-seed")).toBeInTheDocument();
    expect(screen.getByText("South 11-seed")).toBeInTheDocument();
  });

  it("calls onAdvance with the correct gameId and teamId when a team is clicked", async () => {
    const user = userEvent.setup();
    const handleAdvance = vi.fn();
    render(
      <FirstFour
        matchups={ffMatchups}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={handleAdvance}
        playInConfig={playInConfig}
      />
    );
    // Click on Team A (first team button in first matchup)
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    expect(handleAdvance).toHaveBeenCalledWith("FF-East-16", "team-a");
  });

  it("shows 'to R64' indicator when a winner is picked", () => {
    render(
      <FirstFour
        matchups={ffMatchups}
        teams={buildTeamsMap()}
        picks={{ "FF-East-16": "team-a" }}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        playInConfig={playInConfig}
      />
    );
    expect(screen.getByText("to R64")).toBeInTheDocument();
  });

  it("does not show 'to R64' when no winner is picked", () => {
    render(
      <FirstFour
        matchups={ffMatchups}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        playInConfig={playInConfig}
      />
    );
    expect(screen.queryByText("to R64")).toBeNull();
  });

  it("returns null when matchups array is empty", () => {
    const { container } = render(
      <FirstFour
        matchups={[]}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        playInConfig={playInConfig}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("sorts 16-seed matchups before 11-seed matchups", () => {
    // Pass matchups in reverse order (11-seed first)
    const reversedMatchups = [...ffMatchups].reverse();
    render(
      <FirstFour
        matchups={reversedMatchups}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        playInConfig={playInConfig}
      />
    );
    const labels = screen.getAllByText(/\d+-seed/);
    expect(labels[0].textContent).toBe("East 16-seed");
    expect(labels[1].textContent).toBe("South 11-seed");
  });

  it("renders matchup detail buttons when onMatchupClick is provided", () => {
    render(
      <FirstFour
        matchups={ffMatchups}
        teams={buildTeamsMap()}
        picks={{}}
        simulationResult={null}
        matchupOverrides={{}}
        onAdvance={() => {}}
        onMatchupClick={() => {}}
        playInConfig={playInConfig}
      />
    );
    expect(
      screen.getByLabelText("View matchup details for FF-East-16")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("View matchup details for FF-South-11")
    ).toBeInTheDocument();
  });
});
