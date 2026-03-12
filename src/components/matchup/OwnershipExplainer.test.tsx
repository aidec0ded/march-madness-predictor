import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { OwnershipExplainer } from "./OwnershipExplainer";

describe("OwnershipExplainer", () => {
  it("renders the toggle button", () => {
    render(<OwnershipExplainer />);
    expect(
      screen.getByText("How is ownership estimated?")
    ).toBeInTheDocument();
  });

  it("starts collapsed (content not visible)", () => {
    render(<OwnershipExplainer />);
    expect(screen.queryByText("Seed Baseline")).not.toBeInTheDocument();
  });

  it("expands on click to show factor explanations", async () => {
    const user = userEvent.setup();
    render(<OwnershipExplainer />);

    await user.click(screen.getByText("How is ownership estimated?"));

    expect(screen.getByText("Seed Baseline")).toBeInTheDocument();
    expect(screen.getByText("Round Decay")).toBeInTheDocument();
    expect(screen.getByText("Conference Profile")).toBeInTheDocument();
    expect(screen.getByText("Rating Strength")).toBeInTheDocument();
  });

  it("shows the disclaimer footer when expanded", async () => {
    const user = userEvent.setup();
    render(<OwnershipExplainer />);

    await user.click(screen.getByText("How is ownership estimated?"));

    expect(
      screen.getByText(/heuristic estimates of public bracket behavior/i)
    ).toBeInTheDocument();
  });

  it("collapses on second click", async () => {
    const user = userEvent.setup();
    render(<OwnershipExplainer />);

    const toggle = screen.getByText("How is ownership estimated?");
    await user.click(toggle);
    expect(screen.getByText("Seed Baseline")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText("Seed Baseline")).not.toBeInTheDocument();
  });

  it("has correct aria-expanded state", async () => {
    const user = userEvent.setup();
    render(<OwnershipExplainer />);

    const toggle = screen.getByRole("button", {
      name: /how is ownership estimated/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
