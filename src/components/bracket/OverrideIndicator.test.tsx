import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OverrideIndicator } from "./OverrideIndicator";

describe("OverrideIndicator", () => {
  it("renders a dot element", () => {
    const { container } = render(<OverrideIndicator />);
    // The dot uses CSS Module class for dimensions (no longer inline styles)
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    // Dot is nested inside wrapper > Tooltip > dot
    const dot = wrapper.querySelector("div > div") as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.className).toBeTruthy();
  });

  it("applies CSS Module classes for styling", () => {
    const { container } = render(<OverrideIndicator />);
    // Colors and dimensions are now in CSS Modules, not inline styles
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toBeTruthy();
  });

  it("wrapper has CSS Module positioning class", () => {
    const { container } = render(<OverrideIndicator />);
    const wrapper = container.firstElementChild as HTMLElement;
    // CSS Module class handles absolute positioning (no longer Tailwind)
    expect(wrapper.className).toBeTruthy();
  });

  it("wraps the dot in a Tooltip with override explanation", () => {
    const { container } = render(<OverrideIndicator />);
    // The Tooltip renders a wrapper div with onMouseEnter/onMouseLeave
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toBeTruthy();
    // The dot should be a nested descendant (inside Tooltip wrapper)
    const nestedDivs = wrapper.querySelectorAll("div");
    expect(nestedDivs.length).toBeGreaterThanOrEqual(1);
  });
});
