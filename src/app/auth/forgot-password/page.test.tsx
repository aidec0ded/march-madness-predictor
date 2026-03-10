import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ForgotPasswordPage from "./page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResetPasswordForEmail = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the reset password heading and description", () => {
    render(<ForgotPasswordPage />);
    expect(
      screen.getByRole("heading", { name: "Reset Password" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Enter your email and we'll send you a reset link/i)
    ).toBeInTheDocument();
  });

  it("renders the email input", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<ForgotPasswordPage />);
    expect(
      screen.getByRole("button", { name: "Send Reset Link" })
    ).toBeInTheDocument();
  });

  it("renders a link back to sign-in", () => {
    render(<ForgotPasswordPage />);
    const signInLink = screen.getByRole("link", { name: /Sign in/i });
    expect(signInLink).toHaveAttribute("href", "/auth/sign-in");
  });

  it("submits and shows confirmation on success", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "forgot@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "forgot@example.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/auth/reset-password") })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });

    expect(screen.getByText("forgot@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to sign in/i })
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("displays error on failure", async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: "Rate limit exceeded" },
    });
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "forgot@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => {
      expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", async () => {
    mockResetPasswordForEmail.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "forgot@example.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sending reset link..." })
      ).toBeDisabled();
    });
  });
});
