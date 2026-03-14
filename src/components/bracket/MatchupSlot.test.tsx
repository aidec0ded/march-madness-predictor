import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MatchupSlot } from "./MatchupSlot";
import { createStrongTeam, createWeakTeam } from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const teamA = createStrongTeam({
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

const teamB = createWeakTeam({
  teamId: "fdu",
  team: {
    id: "fdu",
    name: "Fairleigh Dickinson Knights",
    shortName: "FDU",
    conference: "NEC",
    campus: { city: "Teaneck", state: "NJ", latitude: 40, longitude: -74 },
  },
  tournamentEntry: { seed: 16, region: "East", bracketPosition: 16 },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MatchupSlot", () => {
  it("renders two team cards (both team names visible)", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    expect(screen.getByText("Duke")).toBeInTheDocument();
    expect(screen.getByText("FDU")).toBeInTheDocument();
  });

  it("renders seed numbers for both teams", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
  });

  it("calls onAdvance with team A id when team A card is clicked", async () => {
    const user = userEvent.setup();
    const handleAdvance = vi.fn();
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={0.95}
        probB={0.05}
        hasOverrides={false}
        onAdvance={handleAdvance}
      />
    );
    // Click team A's card (Duke)
    const buttons = screen.getAllByRole("button");
    // First button is team A (Duke), second is team B (FDU)
    await user.click(buttons[0]);
    expect(handleAdvance).toHaveBeenCalledWith("duke");
  });

  it("calls onAdvance with team B id when team B card is clicked", async () => {
    const user = userEvent.setup();
    const handleAdvance = vi.fn();
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={0.95}
        probB={0.05}
        hasOverrides={false}
        onAdvance={handleAdvance}
      />
    );
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[1]);
    expect(handleAdvance).toHaveBeenCalledWith("fdu");
  });

  it("shows override indicator when hasOverrides is true", () => {
    const { container } = render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={true}
        onAdvance={() => {}}
      />
    );
    // OverrideIndicator renders nested divs inside the container.
    // The outermost slot div has 3+ direct children when override is present
    // (override wrapper, team A card, divider, team B card).
    const slotChildren = container.firstElementChild!.children;
    // With overrides: wrapper + teamA + divider + teamB = 4 children min
    expect(slotChildren.length).toBeGreaterThanOrEqual(4);
  });

  it("does not show override indicator when hasOverrides is false", () => {
    const { container } = render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    // Without overrides: teamA + divider + teamB = 3 children
    const slotChildren = container.firstElementChild!.children;
    expect(slotChildren.length).toBe(3);
  });

  it("marks the winner TeamCard with elevated style", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner="duke"
        probA={0.95}
        probB={0.05}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    // Duke's card should be the winner
    const dukeName = screen.getByText("Duke");
    // Walk up to the button
    const button = dukeName.closest("button");
    expect(button?.style.backgroundColor).toBe("var(--bg-elevated)");
  });

  it("renders matchup detail button when onMatchupClick is provided", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
        onMatchupClick={() => {}}
      />
    );
    expect(
      screen.getByLabelText("View matchup details for R64-East-1")
    ).toBeInTheDocument();
  });

  it("does not render matchup detail button when onMatchupClick is undefined", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    expect(
      screen.queryByLabelText(/View matchup details/)
    ).toBeNull();
  });

  it("calls onMatchupClick with gameId when detail button is clicked", async () => {
    const user = userEvent.setup();
    const handleMatchupClick = vi.fn();
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
        onMatchupClick={handleMatchupClick}
      />
    );
    await user.click(
      screen.getByLabelText("View matchup details for R64-East-1")
    );
    expect(handleMatchupClick).toHaveBeenCalledWith("R64-East-1");
  });

  it("renders TBD slots for null teams", () => {
    render(
      <MatchupSlot
        gameId="R32-East-1"
        round="R32"
        teamA={null}
        teamB={null}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    const tbdElements = screen.getAllByText("TBD");
    expect(tbdElements).toHaveLength(2);
  });

  it("passes ownership data to TeamCards", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={null}
        probB={null}
        hasOverrides={false}
        onAdvance={() => {}}
        ownershipA={75}
        ownershipB={12}
      />
    );
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
  });

  it("passes path probabilities through to TeamCards as tooltips", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={0.85}
        probB={0.15}
        pathProbA={0.72}
        pathProbB={0.08}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    const buttons = screen.getAllByRole("button");
    // Team A button should have path probability tooltip
    expect(buttons[0].title).toContain("Sim path: 72.0% to advance");
    // Team B button should have path probability tooltip
    expect(buttons[1].title).toContain("Sim path: 8.0% to advance");
  });

  it("works without path probabilities (optional props)", () => {
    render(
      <MatchupSlot
        gameId="R64-East-1"
        round="R64"
        teamA={teamA}
        teamB={teamB}
        winner={null}
        probA={0.85}
        probB={0.15}
        hasOverrides={false}
        onAdvance={() => {}}
      />
    );
    const buttons = screen.getAllByRole("button");
    // No path prob, no championship prob → empty tooltip
    expect(buttons[0].title).toBe("");
    expect(buttons[1].title).toBe("");
  });
});
