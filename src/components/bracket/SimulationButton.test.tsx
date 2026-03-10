import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SimulationButton } from "./SimulationButton";

// ---------------------------------------------------------------------------
// Mock the useBracketSimulation hook
// ---------------------------------------------------------------------------

const mockSimulate = vi.fn();
const mockHook = {
  simulate: mockSimulate,
  isSimulating: false,
  simulationResult: null,
};

vi.mock("@/hooks/useBracketSimulation", () => ({
  useBracketSimulation: () => mockHook,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SimulationButton", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSimulate.mockReset();
    mockHook.isSimulating = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'Run Simulation' in idle state", () => {
    render(<SimulationButton />);
    expect(screen.getByText("Run Simulation")).toBeInTheDocument();
  });

  it("renders as a button element", () => {
    render(<SimulationButton />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("is not disabled in idle state", () => {
    render(<SimulationButton />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("calls simulate on click", async () => {
    mockSimulate.mockResolvedValue({});
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    expect(mockSimulate).toHaveBeenCalledTimes(1);
  });

  it("shows 'Simulating...' during loading", async () => {
    // Make simulate hang so we stay in loading state
    mockSimulate.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Simulating...")).toBeInTheDocument();
  });

  it("sets aria-busy during loading", async () => {
    mockSimulate.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("is disabled during loading", async () => {
    mockSimulate.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows 'Done' after successful simulation", async () => {
    mockSimulate.mockResolvedValue({});
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("reverts to idle after success timeout", async () => {
    mockSimulate.mockResolvedValue({});
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
    // Advance past the 2s success timeout
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByText("Run Simulation")).toBeInTheDocument();
  });

  it("shows error message on failure", async () => {
    mockSimulate.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows generic error for non-Error exceptions", async () => {
    mockSimulate.mockRejectedValue("something went wrong");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("Simulation failed")).toBeInTheDocument();
    });
  });

  it("reverts to idle after error timeout", async () => {
    mockSimulate.mockRejectedValue(new Error("fail"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SimulationButton />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("fail")).toBeInTheDocument();
    });
    // Advance past the 3s error timeout
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByText("Run Simulation")).toBeInTheDocument();
  });

  it("is disabled when hook reports isSimulating", () => {
    mockHook.isSimulating = true;
    render(<SimulationButton />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
