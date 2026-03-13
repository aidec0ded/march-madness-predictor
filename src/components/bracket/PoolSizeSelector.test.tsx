import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PoolSizeSelector } from "./PoolSizeSelector";

// ---------------------------------------------------------------------------
// Mock useBracket hook
// ---------------------------------------------------------------------------

let mockState = {
  poolSizeBucket: "medium" as string,
};
const mockDispatch = vi.fn();

vi.mock("@/hooks/useBracket", () => ({
  useBracket: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PoolSizeSelector", () => {
  beforeEach(() => {
    mockState = { poolSizeBucket: "medium" };
    mockDispatch.mockReset();
  });

  it("renders a select element", () => {
    render(<PoolSizeSelector />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
  });

  it("renders a 'Pool' label", () => {
    render(<PoolSizeSelector />);
    expect(screen.getByText("Pool")).toBeInTheDocument();
  });

  it("has the label associated with the select via htmlFor/id", () => {
    render(<PoolSizeSelector />);
    const label = screen.getByText("Pool");
    expect(label).toHaveAttribute("for", "pool-size-select");
    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("id", "pool-size-select");
  });

  it("renders all four pool size options", () => {
    render(<PoolSizeSelector />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
  });

  it("displays the current pool size bucket as selected value", () => {
    render(<PoolSizeSelector />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("medium");
  });

  it("dispatches SET_POOL_SIZE when selection changes", async () => {
    const user = userEvent.setup();
    render(<PoolSizeSelector />);
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "large");
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_POOL_SIZE",
      poolSizeBucket: "large",
    });
  });

  it("renders option labels matching strategy configs", () => {
    render(<PoolSizeSelector />);
    // Check some representative labels
    expect(screen.getByText(/Small/)).toBeInTheDocument();
    expect(screen.getByText(/Medium/)).toBeInTheDocument();
    expect(screen.getByText(/^Large/)).toBeInTheDocument();
  });

  it("reflects a different initial pool size", () => {
    mockState.poolSizeBucket = "very_large";
    render(<PoolSizeSelector />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("very_large");
  });
});
