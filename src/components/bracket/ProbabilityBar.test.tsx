import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProbabilityBar } from "./ProbabilityBar";

describe("ProbabilityBar", () => {
  it("renders a bar container with track class", () => {
    const { container } = render(<ProbabilityBar probability={0.5} />);
    // Outer container uses CSS Module .track class (height set via CSS)
    const outer = container.firstElementChild as HTMLElement;
    expect(outer).toBeTruthy();
    expect(outer.className).toBeTruthy();
  });

  it("sets width proportional to probability", () => {
    const { container } = render(<ProbabilityBar probability={0.75} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner).toBeTruthy();
    expect(inner.style.width).toBe("75%");
  });

  it("uses danger color for low probability (< 0.4)", () => {
    const { container } = render(<ProbabilityBar probability={0.2} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.backgroundColor).toBe("var(--accent-danger)");
  });

  it("uses warning color for competitive probability (0.4 - 0.6)", () => {
    const { container } = render(<ProbabilityBar probability={0.5} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.backgroundColor).toBe("var(--accent-warning)");
  });

  it("uses primary color for high probability (> 0.6)", () => {
    const { container } = render(<ProbabilityBar probability={0.8} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.backgroundColor).toBe("var(--accent-primary)");
  });

  it("clamps probability at 0 (no negative width)", () => {
    const { container } = render(<ProbabilityBar probability={-0.5} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.width).toBe("0%");
  });

  it("clamps probability at 100% (no overflow)", () => {
    const { container } = render(<ProbabilityBar probability={1.5} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.width).toBe("100%");
  });

  it("renders 0% width for probability 0", () => {
    const { container } = render(<ProbabilityBar probability={0} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.width).toBe("0%");
  });

  it("renders 100% width for probability 1", () => {
    const { container } = render(<ProbabilityBar probability={1} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.width).toBe("100%");
  });
});
