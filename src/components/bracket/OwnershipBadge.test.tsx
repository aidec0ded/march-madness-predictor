import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OwnershipBadge } from "./OwnershipBadge";

describe("OwnershipBadge", () => {
  it("renders rounded ownership percentage", () => {
    render(<OwnershipBadge ownershipPct={45.7} />);
    expect(screen.getByText("46%")).toBeInTheDocument();
  });

  it("renders 'own' suffix", () => {
    render(<OwnershipBadge ownershipPct={30} />);
    expect(screen.getByText("own")).toBeInTheDocument();
  });

  it("shows precise value in title tooltip", () => {
    const { container } = render(<OwnershipBadge ownershipPct={45.7} />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.title).toContain("Estimated 45.7% public ownership");
    expect(span.title).toContain("seed position");
  });

  it("uses warning color for high ownership (>= 60%)", () => {
    const { container } = render(<OwnershipBadge ownershipPct={75} />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.style.color).toBe("var(--accent-warning)");
  });

  it("uses muted color for medium ownership (30-60%)", () => {
    const { container } = render(<OwnershipBadge ownershipPct={45} />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.style.color).toBe("var(--text-muted)");
  });

  it("uses success color for low ownership (< 30%)", () => {
    const { container } = render(<OwnershipBadge ownershipPct={15} />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.style.color).toBe("var(--accent-success)");
  });

  it("rounds integer percentages correctly", () => {
    render(<OwnershipBadge ownershipPct={50} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("rounds 0.4 down", () => {
    render(<OwnershipBadge ownershipPct={33.4} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("rounds 0.5 up", () => {
    render(<OwnershipBadge ownershipPct={33.5} />);
    expect(screen.getByText("34%")).toBeInTheDocument();
  });
});
