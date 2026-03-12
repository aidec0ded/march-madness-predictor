import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { BacktestInterpretationGuide } from "./BacktestInterpretationGuide";

describe("BacktestInterpretationGuide", () => {
  it("renders the toggle button", () => {
    render(<BacktestInterpretationGuide />);
    expect(
      screen.getByText("How to Interpret Backtest Results")
    ).toBeInTheDocument();
  });

  it("starts collapsed", () => {
    render(<BacktestInterpretationGuide />);
    expect(screen.queryByText("Brier Score")).not.toBeInTheDocument();
  });

  it("expands to show all 5 sections on click", async () => {
    const user = userEvent.setup();
    render(<BacktestInterpretationGuide />);

    await user.click(
      screen.getByText("How to Interpret Backtest Results")
    );

    expect(screen.getByText("Brier Score")).toBeInTheDocument();
    expect(screen.getByText("Model vs. Baseline")).toBeInTheDocument();
    expect(screen.getByText("Train vs. Test")).toBeInTheDocument();
    expect(screen.getByText("Calibration Chart")).toBeInTheDocument();
    expect(screen.getByText("2021 Anomaly")).toBeInTheDocument();
  });

  it("shows Brier Score explanation content when expanded", async () => {
    const user = userEvent.setup();
    render(<BacktestInterpretationGuide />);

    await user.click(
      screen.getByText("How to Interpret Backtest Results")
    );

    expect(
      screen.getByText(/probability calibration metric/i)
    ).toBeInTheDocument();
  });

  it("collapses on second click", async () => {
    const user = userEvent.setup();
    render(<BacktestInterpretationGuide />);

    const toggle = screen.getByText("How to Interpret Backtest Results");
    await user.click(toggle);
    expect(screen.getByText("Brier Score")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText("Brier Score")).not.toBeInTheDocument();
  });

  it("has correct aria-expanded attribute", async () => {
    const user = userEvent.setup();
    render(<BacktestInterpretationGuide />);

    const toggle = screen.getByRole("button", {
      name: /how to interpret backtest results/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
