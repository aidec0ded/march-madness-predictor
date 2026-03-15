import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TeamCard } from "./TeamCard";
import { createStrongTeam, createWeakTeam } from "@/lib/engine/test-helpers";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const team1Seed = createStrongTeam({
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

const team16Seed = createWeakTeam({
  teamId: "fairleigh",
  team: {
    id: "fairleigh",
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

describe("TeamCard", () => {
  describe("empty slot (team = null)", () => {
    it("renders TBD placeholder when team is null", () => {
      render(
        <TeamCard
          team={null}
          seed={0}
          probability={null}
          isWinner={false}
          isClickable={false}
          onClick={() => {}}
        />
      );
      expect(screen.getByText("TBD")).toBeInTheDocument();
    });

    it("renders as a div (not a button) when team is null", () => {
      const { container } = render(
        <TeamCard
          team={null}
          seed={0}
          probability={null}
          isWinner={false}
          isClickable={false}
          onClick={() => {}}
        />
      );
      expect(container.querySelector("button")).toBeNull();
    });
  });

  describe("with team data", () => {
    it("renders the team short name", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      expect(screen.getByText("Duke")).toBeInTheDocument();
    });

    it("renders the seed number", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("renders as a button element", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("displays probability percentage when provided", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.85}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("does not display probability text when null", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      expect(screen.queryByText(/%/)).toBeNull();
    });

    it("renders ProbabilityBar when probability is provided", () => {
      const { container } = render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.65}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      // ProbabilityBar renders with CSS Module classes; inner fill div has inline width
      const fillBar = container.querySelector(
        'div[style*="width: 65%"]'
      );
      expect(fillBar).toBeTruthy();
    });

    it("does not render ProbabilityBar when probability is null", () => {
      const { container } = render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const barContainer = container.querySelector(
        'div[style*="height: 3px"]'
      );
      expect(barContainer).toBeNull();
    });

  });

  describe("winner styling", () => {
    it("applies elevated background when isWinner is true", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={true}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.style.backgroundColor).toBe("var(--bg-elevated)");
    });

    it("applies accent-primary left border when isWinner is true", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={true}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.style.borderLeft).toBe("2px solid var(--accent-primary)");
    });

    it("has transparent background when not winner", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.style.backgroundColor).toBe("transparent");
    });
  });

  describe("interaction", () => {
    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={handleClick}
        />
      );
      await user.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("is disabled when isClickable is false", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={false}
          onClick={() => {}}
        />
      );
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("does not fire onClick when disabled", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={false}
          onClick={handleClick}
        />
      );
      await user.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has descriptive aria-label including seed, name, and winner status", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.75}
          isWinner={true}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute(
        "aria-label",
        "1 seed Duke Blue Devils, selected winner, 75% win probability"
      );
    });

    it("aria-label omits winner status when not winner", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.75}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).not.toContain(
        "selected winner"
      );
    });

    it("aria-label omits probability when null", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).not.toContain(
        "win probability"
      );
    });

    it("shows championship probability tooltip when provided", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.75}
          championshipProbability={0.123}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.title).toBe("Championship: 12.3%");
    });

    it("shows path probability tooltip when pathProbability is provided", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.85}
          pathProbability={0.72}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.title).toBe("Sim path: 72.0% to advance");
    });

    it("shows combined path + championship tooltip when both provided", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.85}
          pathProbability={0.72}
          championshipProbability={0.15}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.title).toBe(
        "Sim path: 72.0% to advance | Championship: 15.0%"
      );
    });

    it("path probability takes priority over championship-only tooltip", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.85}
          pathProbability={0.5}
          championshipProbability={0.1}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      // Should start with "Sim path:" not just "Championship:"
      expect(button.title).toContain("Sim path:");
      expect(button.title).toContain("Championship:");
    });

    it("has no tooltip when neither path nor championship probability is provided", () => {
      render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={0.85}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const button = screen.getByRole("button");
      expect(button.title).toBe("");
    });
  });

  describe("seed color coding", () => {
    it("uses accent-primary for seeds 1-4", () => {
      const { container } = render(
        <TeamCard
          team={team1Seed}
          seed={1}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const seedSpan = container.querySelector(
        'span[style*="var(--accent-primary)"]'
      );
      expect(seedSpan).toBeTruthy();
      expect(seedSpan?.textContent).toBe("1");
    });

    it("uses accent-warning for seeds 9-12", () => {
      const { container } = render(
        <TeamCard
          team={team16Seed}
          seed={10}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const seedSpan = container.querySelector(
        'span[style*="var(--accent-warning)"]'
      );
      expect(seedSpan).toBeTruthy();
    });

    it("uses text-muted for seeds 13-16", () => {
      const { container } = render(
        <TeamCard
          team={team16Seed}
          seed={16}
          probability={null}
          isWinner={false}
          isClickable={true}
          onClick={() => {}}
        />
      );
      const seedSpan = container.querySelector(
        'span[style*="var(--text-muted)"]'
      );
      expect(seedSpan).toBeTruthy();
      expect(seedSpan?.textContent).toBe("16");
    });
  });
});
