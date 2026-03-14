import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders the title", () => {
    render(<Home />);
    expect(screen.getByText("BracketLab")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<Home />);
    expect(
      screen.getByText(/Monte Carlo simulation meets college basketball/)
    ).toBeInTheDocument();
  });

  it("has a CTA link to the bracket builder", () => {
    render(<Home />);
    const bracketLink = screen.getByRole("link", {
      name: "Build Your Bracket",
    });
    expect(bracketLink).toBeInTheDocument();
    expect(bracketLink).toHaveAttribute("href", "/bracket");
  });

  it("has a CTA link to the backtest module", () => {
    render(<Home />);
    const backtestLink = screen.getByRole("link", {
      name: "Explore Backtest",
    });
    expect(backtestLink).toBeInTheDocument();
    expect(backtestLink).toHaveAttribute("href", "/backtest");
  });

  it("renders feature cards", () => {
    render(<Home />);
    expect(screen.getByText("Monte Carlo Engine")).toBeInTheDocument();
    expect(screen.getByText("Configurable Levers")).toBeInTheDocument();
    expect(screen.getByText("Contest Strategy")).toBeInTheDocument();
  });
});
