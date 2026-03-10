import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let authStateCallback: ((event: string, session: { user: User } | null) => void) | null = null;
const mockUnsubscribe = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: () => ({
    auth: {
      onAuthStateChange: (callback: (event: string, session: { user: User } | null) => void) => {
        authStateCallback = callback;
        return {
          data: {
            subscription: { unsubscribe: mockUnsubscribe },
          },
        };
      },
      signOut: mockSignOut,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Test consumer component
// ---------------------------------------------------------------------------

function AuthConsumer() {
  const { user, isLoading, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user?.email ?? "null"}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockUser(overrides?: Partial<User>): User {
  return {
    id: "user-123",
    email: "test@example.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
  });

  it("provides initialUser immediately without loading state", () => {
    const mockUser = createMockUser();

    render(
      <AuthProvider initialUser={mockUser}>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("user")).toHaveTextContent("test@example.com");
  });

  it("starts in loading state when no initial user is provided", () => {
    render(
      <AuthProvider initialUser={null}>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(screen.getByTestId("user")).toHaveTextContent("null");
  });

  it("updates user when auth state changes to signed-in", async () => {
    render(
      <AuthProvider initialUser={null}>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("user")).toHaveTextContent("null");

    const newUser = createMockUser({ email: "new@example.com" });
    act(() => {
      authStateCallback?.("SIGNED_IN", { user: newUser });
    });

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("new@example.com");
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
  });

  it("clears user when auth state changes to signed-out", async () => {
    const initialUser = createMockUser();

    render(
      <AuthProvider initialUser={initialUser}>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId("user")).toHaveTextContent("test@example.com");

    act(() => {
      authStateCallback?.("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("null");
    });
  });

  it("calls supabase signOut and clears user on signOut()", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    const initialUser = createMockUser();
    const user = userEvent.setup();

    render(
      <AuthProvider initialUser={initialUser}>
        <AuthConsumer />
      </AuthProvider>
    );

    await user.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(mockSignOut).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("null");
    });
  });

  it("unsubscribes from auth state changes on unmount", () => {
    const { unmount } = render(
      <AuthProvider initialUser={null}>
        <AuthConsumer />
      </AuthProvider>
    );

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe("useAuth", () => {
  it("returns default context values when used outside AuthProvider", () => {
    // AuthContext has a default value, so useAuth returns it instead of throwing
    render(<AuthConsumer />);

    // Default context: user=null, isLoading=true
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(screen.getByTestId("user")).toHaveTextContent("null");
  });
});
