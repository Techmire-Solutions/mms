import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth, useOptionalAuth } from "./AuthContext";
import { queryClientInstance } from "@/lib/queryClient";
import { appNavigate } from "@/lib/routing/appNavigate";
import { apiFetch, apiJson } from "@/lib/apiClient";
import { AUTH_USER_STORAGE_KEY } from "./authContextHelpers";
import type { User } from "@mms/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    id: "u1",
    name: "Admin User",
    email: "admin@madrasa.test",
    role: "admin",
    workspaceSubdomain: "demo",
    twoFactorEnabled: false,
  } as User,
}));

vi.mock("@/lib/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apiClient")>();
  return {
    ...actual,
    apiFetch: vi.fn(),
    apiJson: vi.fn(),
    isApiError: (err: unknown) => Boolean((err as { status?: number })?.status),
  };
});

vi.mock("@/lib/queryClient", () => ({
  queryClientInstance: {
    clear: vi.fn(),
    activateTenantSession: vi.fn(async () => {}),
  },
}));

vi.mock("@/lib/routing/appNavigate", () => ({
  appNavigate: vi.fn(),
}));

vi.mock("@/lib/twoFactor", () => ({
  clear2FAState: vi.fn(),
  getPendingChallengeId: vi.fn(() => "challenge-123"),
  mark2FAVerified: vi.fn(),
  setPendingChallengeId: vi.fn(),
}));

vi.mock("@/lib/config/tenantConfig", () => ({
  isCurrentHostApex: () => false,
  getCurrentSubdomain: () => "demo",
}));

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ user: mockUser }),
    } as unknown as never);
    vi.mocked(apiJson).mockResolvedValue({ user: mockUser });
  });

  it("provides safe fallback via useOptionalAuth when rendered outside AuthProvider", () => {
    let capturedAuth: ReturnType<typeof useOptionalAuth> = undefined as unknown as never;
    function Consumer() {
      capturedAuth = useOptionalAuth();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<Consumer />);
    });

    expect(capturedAuth).toBeNull();
    act(() => {
      root.unmount();
    });
  });

  it("hydrates user session and exposes auth methods within AuthProvider", async () => {
    let capturedAuth: ReturnType<typeof useAuth> = undefined as unknown as never;
    function Consumer() {
      capturedAuth = useAuth();
      return <div>{capturedAuth.user?.name ?? "Guest"}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    expect(capturedAuth).toBeDefined();
    expect(typeof capturedAuth.login).toBe("function");
    expect(typeof capturedAuth.verify2FA).toBe("function");
    expect(typeof capturedAuth.logout).toBe("function");

    act(() => {
      root.unmount();
    });
  });

  it("handles login with direct session application", async () => {
    let capturedAuth: ReturnType<typeof useAuth> = undefined as unknown as never;
    function Consumer() {
      capturedAuth = useAuth();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, requires2FA: false }),
    } as unknown as never);

    let result!: Awaited<ReturnType<typeof capturedAuth.login>>;
    await act(async () => {
      result = await capturedAuth.login("admin@madrasa.test", "password123");
    });

    expect(result.requires2FA).toBe(false);
    expect(result.user.id).toBe("u1");
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("handles login with 2FA challenge requirement", async () => {
    let capturedAuth: ReturnType<typeof useAuth> = undefined as unknown as never;
    function Consumer() {
      capturedAuth = useAuth();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, requires2FA: true, challengeId: "ch-999" }),
    } as unknown as never);

    let result!: Awaited<ReturnType<typeof capturedAuth.login>>;
    await act(async () => {
      result = await capturedAuth.login("admin@madrasa.test", "password123");
    });

    expect(result.requires2FA).toBe(true);
    expect(result.challengeId).toBe("ch-999");

    act(() => {
      root.unmount();
    });
  });

  it("handles logout by clearing queryClient and stored session", async () => {
    let capturedAuth: ReturnType<typeof useAuth> = undefined as unknown as never;
    function Consumer() {
      capturedAuth = useAuth();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    act(() => {
      capturedAuth.logout(true);
    });

    expect(queryClientInstance.clear).toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(appNavigate).toHaveBeenCalledWith("/login", { replace: true });

    act(() => {
      root.unmount();
    });
  });

  it("does not repeatedly call /api/auth/me on re-renders when a user is already persisted", async () => {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mockUser));
    function Consumer() {
      const { user } = useAuth();
      return <div>{user?.name}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    // Wait a tick for effects
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Should only call /api/auth/me once on initial mount
    const authMeCalls = vi.mocked(apiJson).mock.calls.filter(([url]) => url === "/api/auth/me");
    expect(authMeCalls.length).toBe(1);

    act(() => {
      root.unmount();
    });
  });

  it("clears state on SESSION_EXPIRED_EVENT", async () => {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mockUser));
    let capturedAuth!: ReturnType<typeof useAuth>;
    function Consumer() {
      capturedAuth = useAuth();
      return <div>{capturedAuth.user?.name}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    expect(capturedAuth.isAuthenticated).toBe(true);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("mms:session-expired", { detail: { reason: "session_idle_expired" } }),
      );
    });

    expect(queryClientInstance.clear).toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(capturedAuth.isAuthenticated).toBe(false);
    expect(capturedAuth.user).toBeNull();
    expect(appNavigate).toHaveBeenCalledWith("/login", { replace: true });

    act(() => {
      root.unmount();
    });
  });

  it("recovers a cookie session from /api/auth/me when no user is persisted", async () => {
    let capturedAuth: ReturnType<typeof useAuth> = undefined as unknown as never;
    function Consumer() {
      capturedAuth = useAuth();
      return <div>{capturedAuth.user?.name ?? "Guest"}</div>;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const authMeCalls = vi.mocked(apiJson).mock.calls.filter(([url]) => url === "/api/auth/me");
    expect(authMeCalls.length).toBe(1);
    expect(capturedAuth.isAuthenticated).toBe(true);
    expect(capturedAuth.user).toEqual(mockUser);
    expect(capturedAuth.isLoadingAuth).toBe(false);
    expect(capturedAuth.authChecked).toBe(true);

    act(() => {
      root.unmount();
    });
  });

  it("does not authenticate from a persisted user before the server confirms the session", async () => {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mockUser));
    let resolveMe!: (value: { user: User }) => void;
    vi.mocked(apiJson).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );
    let capturedAuth!: ReturnType<typeof useAuth>;
    function Consumer() {
      capturedAuth = useAuth();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    expect(capturedAuth.user).toEqual(mockUser);
    expect(capturedAuth.isAuthenticated).toBe(false);
    expect(capturedAuth.authChecked).toBe(false);

    await act(async () => resolveMe({ user: mockUser }));
    expect(capturedAuth.isAuthenticated).toBe(true);
    expect(capturedAuth.authChecked).toBe(true);
    act(() => root.unmount());
  });
});
