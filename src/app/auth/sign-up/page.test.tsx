import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignUpPage from "./page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignUp = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      signUp: mockSignUp,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the create account heading and tagline", () => {
    render(<SignUpPage />);
    expect(
      screen.getByRole("heading", { name: "Create Account" })
    ).toBeInTheDocument();
    expect(screen.getByText("The Bracket Lab")).toBeInTheDocument();
  });

  it("renders email, password, and confirm password inputs", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<SignUpPage />);
    expect(
      screen.getByRole("button", { name: "Create Account" })
    ).toBeInTheDocument();
  });

  it("renders a link to the sign-in page", () => {
    render(<SignUpPage />);
    const signInLink = screen.getByRole("link", { name: /Sign in/i });
    expect(signInLink).toHaveAttribute("href", "/auth/sign-in");
  });

  it("shows error when passwords do not match", async () => {
    const user = userEvent.setup();

    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password456");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("shows error when password is too short", async () => {
    const user = userEvent.setup();

    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(
      screen.getByText("Password must be at least 8 characters.")
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("submits the form and shows confirmation on success", async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          password: "password123",
        })
      );
    });

    // Should show the success / confirmation view
    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to sign in/i })
    ).toHaveAttribute("href", "/auth/sign-in");
  });

  it("displays error from Supabase on sign-up failure", async () => {
    mockSignUp.mockResolvedValue({
      error: { message: "User already registered" },
    });
    const user = userEvent.setup();

    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Email"), "existing@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(screen.getByText("User already registered")).toBeInTheDocument();
    });
  });

  it("shows loading state during submission", async () => {
    mockSignUp.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Creating account..." })
      ).toBeDisabled();
    });
  });
});
