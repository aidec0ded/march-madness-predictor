import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignInPage from "./page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignInWithOAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => (key === "redirect" ? null : null),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign-in heading and tagline", () => {
    render(<SignInPage />);
    expect(screen.getByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByText("BracketLab")).toBeInTheDocument();
  });

  it("renders email and password inputs", () => {
    render(<SignInPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<SignInPage />);
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("renders OAuth buttons for Google and GitHub", () => {
    render(<SignInPage />);
    expect(screen.getByRole("button", { name: /Google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GitHub/i })).toBeInTheDocument();
  });

  it("renders links to sign-up and forgot-password pages", () => {
    render(<SignInPage />);
    const signUpLink = screen.getByRole("link", { name: /Sign up/i });
    expect(signUpLink).toHaveAttribute("href", "/auth/sign-up");

    const forgotLink = screen.getByRole("link", { name: /Forgot your password/i });
    expect(forgotLink).toHaveAttribute("href", "/auth/forgot-password");
  });

  it("submits the form and redirects on success", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("displays an error message on failed sign-in", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const user = userEvent.setup();

    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows loading state during submission", async () => {
    // Make signIn hang indefinitely so we can observe the loading state
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
    });
  });

  it("calls signInWithOAuth when Google button is clicked", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: /Google/i }));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" })
    );
  });

  it("calls signInWithOAuth when GitHub button is clicked", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: /GitHub/i }));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "github" })
    );
  });

  it("displays error when OAuth sign-in fails", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: "OAuth provider error" },
    });
    const user = userEvent.setup();

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: /Google/i }));

    await waitFor(() => {
      expect(screen.getByText("OAuth provider error")).toBeInTheDocument();
    });
  });
});
