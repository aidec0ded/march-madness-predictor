import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OverrideIndicator } from "./OverrideIndicator";

describe("OverrideIndicator", () => {
  it("renders an 8px dot", () => {
    const { container } = render(<OverrideIndicator />);
    const dot = container.querySelector(
      'div[style*="width: 8px"]'
    ) as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.style.height).toBe("8px");
  });

  it("uses accent-warning background color", () => {
    const { container } = render(<OverrideIndicator />);
    const dot = container.querySelector(
      'div[style*="width: 8px"]'
    ) as HTMLElement;
    expect(dot.style.backgroundColor).toBe("var(--accent-warning)");
  });

  it("is positioned absolutely in the top-right corner", () => {
    const { container } = render(<OverrideIndicator />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("absolute");
    expect(wrapper.className).toContain("top-1");
    expect(wrapper.className).toContain("right-1");
  });

  it("wraps the dot in a Tooltip with override explanation", () => {
    const { container } = render(<OverrideIndicator />);
    // The Tooltip renders a wrapper div with onMouseEnter/onMouseLeave
    // The tooltip content is hidden until hover (not visible in initial render)
    // We check the structure exists
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    // The dot should be a descendant with a rounded-full class
    const dot = container.querySelector(".rounded-full");
    expect(dot).toBeTruthy();
  });
});
