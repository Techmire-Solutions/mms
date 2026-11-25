import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth, useOptionalAuth } from "./AuthContext";
import { queryClientInstance } from "../query/queryClient";
import { appNavigate } from "../routing/appNavigate";
import { apiFetch, apiJson } from "../api/client";
import { AUTH_PATHS } from "../api/helpers";
import { AUTH_USER_STORAGE_KEY } from "./authContextHelpers";
import type { User } from "@mms/contracts";

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

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    apiFetch: vi.fn(),
    apiJson: vi.fn(),
    isApiError: (err: unknown) => Boolean((err as { status?: number })?.status),
  };
});

vi.mock("../query/queryClient", () => ({
  queryClientInstance: {
    clear: vi.fn(),
    activateTenantSession: vi.fn(async () => {}),
  },
}));

vi.mock("../routing/appNavigate", () => ({
  appNavigate: vi.fn(),
}));

vi.mock("./twoFactor", () => ({
  clear2FAState: vi.fn(),
  getPendingChallengeId: vi.fn(() => "challenge-123"),
  mark2FAVerified: vi.fn(),
  setPendingChallengeId: vi.fn(),
}));

vi.mock("../config/tenantConfig", () => ({
  isCurrentHostApex: () => false,
  getCurrentSubdomain: () => "demo",
}));

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, "", "/");
    document.cookie = "csrf_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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

  it("does not repeatedly call the session probe on re-renders when a user is already persisted", async () => {
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

    // Should only call the soft session probe once on initial mount
    const sessionProbeCalls = vi
      .mocked(apiJson)
      .mock.calls.filter(([url]) => url === AUTH_PATHS.session);
    expect(sessionProbeCalls.length).toBe(1);

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

  it("recovers a cookie session from the soft probe when no user is persisted", async () => {
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

    const sessionProbeCalls = vi
      .mocked(apiJson)
      .mock.calls.filter(([url]) => url === AUTH_PATHS.session);
    expect(sessionProbeCalls.length).toBe(1);
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

  it("skips the session probe on entry routes when no user or session indicator exists", async () => {
    window.history.pushState({}, "", "/login");
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

    const bootCalls = vi
      .mocked(apiJson)
      .mock.calls.filter(([url]) => url === AUTH_PATHS.session || url === AUTH_PATHS.me);
    expect(bootCalls).toHaveLength(0);
    expect(capturedAuth.isAuthenticated).toBe(false);
    expect(capturedAuth.authChecked).toBe(true);
    expect(capturedAuth.isLoadingAuth).toBe(false);

    act(() => {
      root.unmount();
    });
    window.history.pushState({}, "", "/");
  });

  it("soft-probes /api/auth/session on entry routes when a session indicator cookie is present", async () => {
    document.cookie = "csrf_token=valid-csrf-token; path=/";
    window.history.pushState({}, "", "/login");
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

    const sessionCalls = vi
      .mocked(apiJson)
      .mock.calls.filter(([url]) => url === AUTH_PATHS.session);
    const authMeCalls = vi.mocked(apiJson).mock.calls.filter(([url]) => url === AUTH_PATHS.me);
    expect(sessionCalls).toHaveLength(1);
    expect(authMeCalls).toHaveLength(0);
    expect(capturedAuth.isAuthenticated).toBe(true);
    expect(capturedAuth.user).toEqual(mockUser);

    act(() => {
      root.unmount();
    });
    document.cookie = "csrf_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.history.pushState({}, "", "/");
  });

  it("stays a guest without refreshing when the login page soft-probe finds no session", async () => {
    document.cookie = "csrf_token=stale-csrf-token; path=/";
    window.history.pushState({}, "", "/login");
    vi.mocked(apiJson).mockResolvedValue({ user: null });
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

    const sessionCalls = vi
      .mocked(apiJson)
      .mock.calls.filter(([url]) => url === AUTH_PATHS.session);
    const refreshCalls = vi
      .mocked(apiJson)
      .mock.calls.filter(([url]) => url === AUTH_PATHS.refresh);
    expect(sessionCalls).toHaveLength(1);
    // No persisted identity and an entry route: a stale csrf cookie must not trigger a request
    // that can only 401 (the reported login-page console error).
    expect(refreshCalls).toHaveLength(0);
    expect(capturedAuth.isAuthenticated).toBe(false);
    expect(capturedAuth.user).toBeNull();
    expect(capturedAuth.authChecked).toBe(true);

    act(() => {
      root.unmount();
    });
    document.cookie = "csrf_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.history.pushState({}, "", "/");
  });

  it("restores an expired access session by refreshing before treating it as dead", async () => {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mockUser));
    document.cookie = "csrf_token=valid-csrf-token; path=/";
    vi.mocked(apiJson).mockImplementation((url: string) =>
      url === AUTH_PATHS.refresh
        ? Promise.resolve({ user: mockUser })
        : Promise.resolve({ user: null }),
    );
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

    expect(
      vi.mocked(apiJson).mock.calls.filter(([url]) => url === AUTH_PATHS.session),
    ).toHaveLength(1);
    expect(
      vi.mocked(apiJson).mock.calls.filter(([url]) => url === AUTH_PATHS.refresh),
    ).toHaveLength(1);
    expect(capturedAuth.isAuthenticated).toBe(true);
    expect(capturedAuth.user).toEqual(mockUser);
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).not.toBeNull();

    act(() => {
      root.unmount();
    });
    document.cookie = "csrf_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.history.pushState({}, "", "/");
  });

  it("clears identity and cache when the refresh attempt rejects a dead session", async () => {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mockUser));
    document.cookie = "csrf_token=valid-csrf-token; path=/";
    vi.mocked(apiJson).mockImplementation((url: string) =>
      url === AUTH_PATHS.refresh
        ? Promise.reject({ status: 401, message: "Invalid refresh token" })
        : Promise.resolve({ user: null }),
    );
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

    expect(queryClientInstance.clear).toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(capturedAuth.isAuthenticated).toBe(false);
    expect(capturedAuth.user).toBeNull();
    expect(capturedAuth.authChecked).toBe(true);

    act(() => {
      root.unmount();
    });
    document.cookie = "csrf_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.history.pushState({}, "", "/");
  });

  it("treats a soft-probe null with no refresh cookie as a dead session", async () => {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(mockUser));
    vi.mocked(apiJson).mockResolvedValue({ user: null });
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

    expect(
      vi.mocked(apiJson).mock.calls.filter(([url]) => url === AUTH_PATHS.refresh),
    ).toHaveLength(0);
    expect(queryClientInstance.clear).toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(capturedAuth.isAuthenticated).toBe(false);

    act(() => {
      root.unmount();
    });
    window.history.pushState({}, "", "/");
  });

  it("keeps auth operation identities stable across provider re-renders", async () => {
    // The context value lists the auth ops in its memo deps: if any op is
    // recreated per render, every consumer re-renders on every provider render
    // (this is what the previous exhaustive-deps disable papered over).
    const loginIds: unknown[] = [];
    const verify2FAIds: unknown[] = [];
    const logoutIds: Array<{ fn: unknown; user: ReturnType<typeof useAuth>["user"] }> = [];
    let capturedAuth: ReturnType<typeof useAuth> = undefined as unknown as never;

    function Consumer() {
      const auth = useAuth();
      capturedAuth = auth;
      loginIds.push(auth.login);
      verify2FAIds.push(auth.verify2FA);
      logoutIds.push({ fn: auth.logout, user: auth.user });
      return <div>{auth.user?.name ?? "Guest"}</div>;
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

    // A login flow forces several provider re-renders (loading, user, checked).
    await act(async () => {
      await capturedAuth.login("admin@madrasa.test", "password");
    });

    expect(loginIds.length).toBeGreaterThan(1);
    expect(new Set(loginIds).size).toBe(1);
    expect(new Set(verify2FAIds).size).toBe(1);
    // `logout` is memoized on `user` (already a dep of the context memo), so its
    // identity may only change when the user changes — never on unrelated renders.
    const logoutByUser = new Map<ReturnType<typeof useAuth>["user"], unknown>();
    for (const { fn, user } of logoutIds) {
      if (!logoutByUser.has(user)) logoutByUser.set(user, fn);
      expect(logoutByUser.get(user)).toBe(fn);
    }

    act(() => {
      root.unmount();
    });
  });
});
