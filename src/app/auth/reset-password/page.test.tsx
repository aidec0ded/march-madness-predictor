import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ResetPasswordPage from "./page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the set new password heading", () => {
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole("heading", { name: "Set New Password" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter your new password below.")
    ).toBeInTheDocument();
  });

  it("renders password and confirm password inputs", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole("button", { name: "Update Password" })
    ).toBeInTheDocument();
  });

  it("renders a link back to sign-in", () => {
    render(<ResetPasswordPage />);
    const signInLink = screen.getByRole("link", { name: /Back to sign in/i });
    expect(signInLink).toHaveAttribute("href", "/auth/sign-in");
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New Password"), "newpassword123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "differentpassword"
    );
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("shows error when password is too short", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm New Password"), "short");
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    expect(
      screen.getByText("Password must be at least 8 characters.")
    ).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("submits and shows success on update", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New Password"), "newpassword123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpassword123"
    );
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "newpassword123",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Password updated")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", { name: /Go to sign in now/i })
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("redirects to sign-in after successful update with a delay", async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New Password"), "newpassword123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpassword123"
    );
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(screen.getByText("Password updated")).toBeInTheDocument();
    });

    // Advance past the 3-second redirect delay
    vi.advanceTimersByTime(3500);

    expect(mockPush).toHaveBeenCalledWith("/auth/sign-in");
  });

  it("displays error from Supabase on update failure", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "Password too weak" },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New Password"), "newpassword123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpassword123"
    );
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(screen.getByText("Password too weak")).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", async () => {
    mockUpdateUser.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<ResetPasswordPage />);

    await user.type(screen.getByLabelText("New Password"), "newpassword123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpassword123"
    );
    await user.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Updating password..." })
      ).toBeDisabled();
    });
  });
});
