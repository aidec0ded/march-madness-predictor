import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders the title", () => {
    render(<Home />);
    expect(screen.getByText("March Madness Predictor")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<Home />);
    expect(
      screen.getByText(/Monte Carlo simulation meets college basketball/)
    ).toBeInTheDocument();
  });

  it("shows development phase indicator", () => {
    render(<Home />);
    expect(screen.getByText(/In Development — Phase 0/)).toBeInTheDocument();
  });
});
