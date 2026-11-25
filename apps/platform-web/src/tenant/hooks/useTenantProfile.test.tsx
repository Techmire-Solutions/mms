import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { TENANT_PROFILE_KEY, useTenantProfile } from "./useTenantProfile";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn<(options: Record<string, unknown>) => unknown>(() => ({})),
  isAuthenticated: true,
}));

vi.mock("@mms/fe-core/api/tsRest", () => ({
  tsrClient: { profile: { getProfile: { useQuery: mocks.useQuery } } },
}));
vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));

function renderHook(enabled?: boolean): void {
  function Harness() {
    useTenantProfile(enabled);
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(<Harness />);
  });
  act(() => {
    root.unmount();
  });
}

describe("useTenantProfile", () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useQuery.mockReturnValue({});
    mocks.isAuthenticated = true;
  });

  it("scopes the profile cache key under the auth segment (no IndexedDB persistence)", () => {
    // Regression: ["tenant","profile"] would be restored from IndexedDB across
    // sessions; profile payloads are user-scoped and must not persist.
    expect(TENANT_PROFILE_KEY).toEqual(["auth", "tenant", "profile"]);
  });

  it("gates the query on the resolved session and the caller's enabled flag", () => {
    mocks.isAuthenticated = false;
    renderHook();
    expect(mocks.useQuery.mock.calls[0][0]).toMatchObject({
      queryKey: TENANT_PROFILE_KEY,
      enabled: false,
    });

    mocks.useQuery.mockReset();
    mocks.useQuery.mockReturnValue({});
    mocks.isAuthenticated = true;
    renderHook();
    expect(mocks.useQuery.mock.calls[0][0]).toMatchObject({ enabled: true });

    mocks.useQuery.mockReset();
    mocks.useQuery.mockReturnValue({});
    renderHook(false);
    expect(mocks.useQuery.mock.calls[0][0]).toMatchObject({ enabled: false });
  });

  it("selects the profile payload out of the ts-rest envelope", () => {
    renderHook();
    const options = mocks.useQuery.mock.calls[0][0] as unknown as {
      select: (data: unknown) => unknown;
    };
    const profile = { name: "Amina" };
    expect(options.select({ body: { profile } })).toBe(profile);
  });
});
