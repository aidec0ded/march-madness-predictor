import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SimulationButton } from "./SimulationButton";

// ---------------------------------------------------------------------------
// Mock the useBracketSimulation hook
// ---------------------------------------------------------------------------

const mockSimulate = vi.fn();
const mockHook: {
  simulate: typeof mockSimulate;
  isSimulating: boolean;
  simulationResult: null;
  isSimulationStale: boolean;
  simulationProgress: { completed: number; total: number; elapsedMs: number } | null;
} = {
  simulate: mockSimulate,
  isSimulating: false,
  simulationResult: null,
  isSimulationStale: false,
  simulationProgress: null,
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
    mockHook.isSimulationStale = false;
    mockHook.simulationProgress = null;
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

  describe("staleness indicator", () => {
    it("shows 'Re-run Simulation' when stale", () => {
      mockHook.isSimulationStale = true;
      render(<SimulationButton />);
      expect(screen.getByText("Re-run Simulation")).toBeInTheDocument();
    });

    it("shows warning dot when stale and idle", () => {
      mockHook.isSimulationStale = true;
      render(<SimulationButton />);
      const dot = screen.getByLabelText("Simulation results are outdated");
      expect(dot).toBeInTheDocument();
    });

    it("does not show warning dot when not stale", () => {
      mockHook.isSimulationStale = false;
      render(<SimulationButton />);
      expect(
        screen.queryByLabelText("Simulation results are outdated")
      ).not.toBeInTheDocument();
    });

    it("has stale tooltip when stale", () => {
      mockHook.isSimulationStale = true;
      render(<SimulationButton />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute(
        "title",
        expect.stringContaining("picks or levers changed")
      );
    });

    it("has default tooltip when not stale", () => {
      mockHook.isSimulationStale = false;
      render(<SimulationButton />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute(
        "title",
        expect.stringContaining("10,000 bracket simulations")
      );
    });
  });

  describe("simulation progress", () => {
    it("shows percentage when progress is available during loading", async () => {
      mockHook.simulationProgress = { completed: 5000, total: 10000, elapsedMs: 500 };
      mockSimulate.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SimulationButton />);
      await user.click(screen.getByRole("button"));
      expect(screen.getByText("Simulating... 50%")).toBeInTheDocument();
    });

    it("shows progress bar when progress is available during loading", async () => {
      mockHook.simulationProgress = { completed: 2500, total: 10000, elapsedMs: 250 };
      mockSimulate.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SimulationButton />);
      await user.click(screen.getByRole("button"));
      const bar = screen.getByTestId("simulation-progress-bar");
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveStyle({ width: "25%" });
    });

    it("does not show progress bar when progress is null", async () => {
      mockHook.simulationProgress = null;
      mockSimulate.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SimulationButton />);
      await user.click(screen.getByRole("button"));
      expect(screen.queryByTestId("simulation-progress-bar")).not.toBeInTheDocument();
    });

    it("does not show progress bar in idle state even with progress data", () => {
      mockHook.simulationProgress = { completed: 5000, total: 10000, elapsedMs: 500 };
      render(<SimulationButton />);
      expect(screen.queryByTestId("simulation-progress-bar")).not.toBeInTheDocument();
    });
  });

  describe("onSimulationComplete callback", () => {
    it("calls onSimulationComplete after successful simulation", async () => {
      mockSimulate.mockResolvedValue({});
      const onComplete = vi.fn();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SimulationButton onSimulationComplete={onComplete} />);
      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });

    it("does not call onSimulationComplete on failure", async () => {
      mockSimulate.mockRejectedValue(new Error("fail"));
      const onComplete = vi.fn();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SimulationButton onSimulationComplete={onComplete} />);
      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByText("fail")).toBeInTheDocument();
      });
      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
