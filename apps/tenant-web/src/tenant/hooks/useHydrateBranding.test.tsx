import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

const mocks = vi.hoisted(() => ({
  user: { id: "u1", role: "admin" } as { id: string; role: string } | null,
  isAuthenticated: true,
  authChecked: true,
  isApex: false,
  subdomain: "darululoom" as string | null,
  workspace: { subdomain: "darululoom" } as Record<string, unknown> | null,
  pathname: "/dashboard",
  entryPath: false,
  hydrateBrandingFromServer: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({
    user: mocks.user,
    isAuthenticated: mocks.isAuthenticated,
    authChecked: mocks.authChecked,
  }),
}));

vi.mock("@mms/fe-core/tenant", () => ({
  useTenant: () => ({
    isApex: mocks.isApex,
    subdomain: mocks.subdomain,
    workspace: mocks.workspace,
  }),
}));

vi.mock("@mms/fe-core/config/routes", () => ({
  isEntryPath: () => mocks.entryPath,
}));

vi.mock("@/lib/brandingHydration", () => ({
  hydrateBrandingFromServer: () => mocks.hydrateBrandingFromServer(),
}));

import { resetBrandingHydrationForTests, useHydrateBranding } from "./useHydrateBranding";

describe("useHydrateBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBrandingHydrationForTests();
    mocks.user = { id: "u1", role: "admin" };
    mocks.isAuthenticated = true;
    mocks.authChecked = true;
    mocks.isApex = false;
    mocks.subdomain = "darululoom";
    mocks.workspace = { subdomain: "darululoom" };
    mocks.pathname = "/dashboard";
    mocks.entryPath = false;
    mocks.hydrateBrandingFromServer.mockResolvedValue(true);
  });

  it("skips hydration on apex, entry paths, unauthenticated sessions, or roles without write permission", () => {
    const cases: Array<() => void> = [
      () => {
        mocks.isApex = true;
      },
      () => {
        mocks.isApex = false;
        mocks.subdomain = null;
      },
      () => {
        mocks.subdomain = "darululoom";
        mocks.workspace = null;
      },
      () => {
        mocks.workspace = { subdomain: "darululoom" };
        mocks.authChecked = false;
      },
      () => {
        mocks.authChecked = true;
        mocks.isAuthenticated = false;
      },
      () => {
        mocks.isAuthenticated = true;
        mocks.user = { id: "u2", role: "student" };
      },
      () => {
        mocks.user = { id: "u1", role: "admin" };
        mocks.entryPath = true;
      },
    ];

    for (const applyCase of cases) {
      applyCase();
      let state = { isHydrating: true };
      function Probe() {
        state = useHydrateBranding();
        return null;
      }
      const div = document.createElement("div");
      const root = createRoot(div);
      act(() => root.render(<Probe />));
      expect(state.isHydrating).toBe(false);
      act(() => root.unmount());
    }
    expect(mocks.hydrateBrandingFromServer).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent mounts, marks tenant hydrated, and fails open on network error", async () => {
    let resolveFetch!: (value: boolean) => void;
    mocks.hydrateBrandingFromServer.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    let firstState = { isHydrating: false };
    let secondState = { isHydrating: false };
    function ProbeA() {
      firstState = useHydrateBranding();
      return null;
    }
    function ProbeB() {
      secondState = useHydrateBranding();
      return null;
    }

    const divA = document.createElement("div");
    const divB = document.createElement("div");
    const rootA = createRoot(divA);
    const rootB = createRoot(divB);

    act(() => {
      rootA.render(<ProbeA />);
      rootB.render(<ProbeB />);
    });
    expect(firstState.isHydrating).toBe(true);
    expect(secondState.isHydrating).toBe(true);
    expect(mocks.hydrateBrandingFromServer).toHaveBeenCalledTimes(1);

    // Unmount rootB before completion to exercise the `if (active)` cleanup guard
    act(() => rootB.unmount());

    await act(async () => {
      resolveFetch(true);
      await Promise.resolve();
    });
    expect(firstState.isHydrating).toBe(false);
    act(() => rootA.unmount());

    // Subsequent mount for same subdomain skips re-fetching
    const rootC = createRoot(document.createElement("div"));
    act(() => rootC.render(<ProbeA />));
    expect(firstState.isHydrating).toBe(false);
    expect(mocks.hydrateBrandingFromServer).toHaveBeenCalledTimes(1);
    act(() => rootC.unmount());

    // Failed fetch on another tenant fails open cleanly
    mocks.subdomain = "second-tenant";
    mocks.hydrateBrandingFromServer.mockRejectedValueOnce(new Error("offline"));
    const rootD = createRoot(document.createElement("div"));
    await act(async () => {
      rootD.render(<ProbeA />);
      await Promise.resolve();
    });
    expect(firstState.isHydrating).toBe(false);
    act(() => rootD.unmount());
  });
});
