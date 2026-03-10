import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GuidancePanel } from "./GuidancePanel";
import type { GuidanceMessage } from "@/types/guidance";

// ---------------------------------------------------------------------------
// Mock useGuidance hook
// ---------------------------------------------------------------------------

let mockMessages: GuidanceMessage[] = [];

vi.mock("@/hooks/useGuidance", () => ({
  useGuidance: () => mockMessages,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleMessages: GuidanceMessage[] = [
  {
    id: "upset-1",
    title: "High Upset Count",
    description: "You have selected 5 first-round upsets, above the historical average.",
    severity: "warning",
    category: "upset_volume",
  },
  {
    id: "chalk-1",
    title: "Chalk-Heavy Bracket",
    description: "Your bracket is heavily chalk, limiting differentiation in large pools.",
    severity: "info",
    category: "chalk_concentration",
  },
  {
    id: "variance-1",
    title: "Variance Risk",
    description: "A high-tempo team is projected deep but faces variance risk.",
    severity: "danger",
    category: "variance_mismatch",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GuidancePanel", () => {
  beforeEach(() => {
    mockMessages = [];
  });

  describe("visibility", () => {
    it("returns null when isOpen is false", () => {
      const { container } = render(
        <GuidancePanel isOpen={false} onClose={() => {}} />
      );
      expect(container.firstElementChild).toBeNull();
    });

    it("renders content when isOpen is true", () => {
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);
      expect(screen.getByText("Guidance")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no guidance messages exist", () => {
      mockMessages = [];
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);
      expect(
        screen.getByText(
          "No guidance to display. Make bracket picks to see contextual advice."
        )
      ).toBeInTheDocument();
    });
  });

  describe("with messages", () => {
    beforeEach(() => {
      mockMessages = [...sampleMessages];
    });

    it("renders all guidance message titles", () => {
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);
      expect(screen.getByText("High Upset Count")).toBeInTheDocument();
      expect(screen.getByText("Chalk-Heavy Bracket")).toBeInTheDocument();
      expect(screen.getByText("Variance Risk")).toBeInTheDocument();
    });

    it("renders message descriptions", () => {
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);
      expect(
        screen.getByText(/You have selected 5 first-round upsets/)
      ).toBeInTheDocument();
    });

    it("shows severity labels", () => {
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);
      expect(screen.getByText("WARN")).toBeInTheDocument();
      expect(screen.getByText("INFO")).toBeInTheDocument();
      expect(screen.getByText("HIGH")).toBeInTheDocument();
    });

    it("shows message count badge", () => {
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  describe("close button", () => {
    it("calls onClose when close button is clicked", async () => {
      mockMessages = [...sampleMessages];
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(<GuidancePanel isOpen={true} onClose={handleClose} />);

      const closeButton = screen.getByLabelText("Close guidance panel");
      await user.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("dismiss functionality", () => {
    beforeEach(() => {
      mockMessages = [...sampleMessages];
    });

    it("hides a message when its dismiss button is clicked", async () => {
      const user = userEvent.setup();
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);

      // Find the dismiss button for the first message
      const dismissButton = screen.getByLabelText(
        "Dismiss: High Upset Count"
      );
      await user.click(dismissButton);

      // The message should no longer be visible
      expect(screen.queryByText("High Upset Count")).toBeNull();
      // Other messages should remain
      expect(screen.getByText("Chalk-Heavy Bracket")).toBeInTheDocument();
    });

    it("shows 'Show N dismissed' link after dismissing", async () => {
      const user = userEvent.setup();
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);

      const dismissButton = screen.getByLabelText(
        "Dismiss: High Upset Count"
      );
      await user.click(dismissButton);

      expect(screen.getByText("Show 1 dismissed")).toBeInTheDocument();
    });

    it("restores dismissed messages when 'Show dismissed' is clicked", async () => {
      const user = userEvent.setup();
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);

      // Dismiss a message
      await user.click(
        screen.getByLabelText("Dismiss: High Upset Count")
      );
      expect(screen.queryByText("High Upset Count")).toBeNull();

      // Click "Show dismissed"
      await user.click(screen.getByText("Show 1 dismissed"));

      // Message should reappear
      expect(screen.getByText("High Upset Count")).toBeInTheDocument();
    });

    it("shows 'All guidance messages dismissed' when all are dismissed", async () => {
      const user = userEvent.setup();
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);

      // Dismiss all three messages
      await user.click(
        screen.getByLabelText("Dismiss: High Upset Count")
      );
      await user.click(
        screen.getByLabelText("Dismiss: Chalk-Heavy Bracket")
      );
      await user.click(
        screen.getByLabelText("Dismiss: Variance Risk")
      );

      expect(
        screen.getByText("All guidance messages dismissed.")
      ).toBeInTheDocument();
    });

    it("updates the count badge when messages are dismissed", async () => {
      const user = userEvent.setup();
      render(<GuidancePanel isOpen={true} onClose={() => {}} />);

      // Initially 3
      expect(screen.getByText("3")).toBeInTheDocument();

      await user.click(
        screen.getByLabelText("Dismiss: High Upset Count")
      );

      // Now 2 visible
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});
