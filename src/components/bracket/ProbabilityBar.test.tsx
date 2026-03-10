import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProbabilityBar } from "./ProbabilityBar";

describe("ProbabilityBar", () => {
  it("renders a bar container", () => {
    const { container } = render(<ProbabilityBar probability={0.5} />);
    // Outer container with 3px height
    const outer = container.firstElementChild as HTMLElement;
    expect(outer).toBeTruthy();
    expect(outer.style.height).toBe("3px");
  });

  it("sets width proportional to probability", () => {
    const { container } = render(<ProbabilityBar probability={0.75} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner).toBeTruthy();
    expect(inner.style.width).toBe("75%");
  });

  it("uses danger color for low probability (< 0.3)", () => {
    const { container } = render(<ProbabilityBar probability={0.15} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.backgroundColor).toBe("var(--accent-danger)");
  });

  it("uses warning color for medium probability (0.3 - 0.6)", () => {
    const { container } = render(<ProbabilityBar probability={0.45} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.backgroundColor).toBe("var(--accent-warning)");
  });

  it("uses success color for high probability (>= 0.6)", () => {
    const { container } = render(<ProbabilityBar probability={0.8} />);
    const inner = container.querySelector(
      "div > div > div"
    ) as HTMLElement;
    expect(inner.style.backgroundColor).toBe("var(--accent-success)");
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
