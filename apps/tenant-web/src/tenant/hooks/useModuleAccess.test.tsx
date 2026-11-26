import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import type { ModuleAvailabilityMap } from "@mms/contracts";

const mocks = vi.hoisted(() => ({
  isAuthenticated: true,
  can: vi.fn<(perm: string) => boolean>(() => true),
  queryResult: {
    isError: false,
    data: undefined as ModuleAvailabilityMap | undefined,
    refetch: vi.fn(),
  },
}));

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: mocks.can }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => mocks.queryResult,
  };
});

import { useModuleAccess, type ModuleAccessState } from "./useModuleAccess";

describe("useModuleAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated = true;
    mocks.can.mockReturnValue(true);
    mocks.queryResult = {
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    };
  });

  function readState(): ModuleAccessState {
    let captured!: ModuleAccessState;
    function Probe() {
      captured = useModuleAccess();
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));
    act(() => root.unmount());
    return captured;
  }

  it("returns pending and denies modules before server availability resolves", () => {
    const state = readState();
    expect(state.status).toBe("pending");
    expect(state.availability).toBeNull();
    expect(state.evaluate("students", "read").allowed).toBe(false);
  });

  it("returns error and invokes refetch on retry when query fails", () => {
    mocks.can.mockReturnValue(false);
    mocks.queryResult = {
      isError: true,
      data: { students: { granted: true, enabled: true } } as unknown as ModuleAvailabilityMap,
      refetch: vi.fn(),
    };
    const state = readState();
    expect(state.status).toBe("error");
    expect(state.availability).toBeNull();
    expect(state.canManageModules).toBe(false);
    state.retry();
    expect(mocks.queryResult.refetch).toHaveBeenCalledTimes(1);
  });

  it("evaluates ready availability and effective module flags", () => {
    mocks.queryResult = {
      isError: false,
      data: {
        students: { granted: true, enabled: true },
        tasks: { granted: true, enabled: false },
      } as unknown as ModuleAvailabilityMap,
      refetch: vi.fn(),
    };
    const state = readState();
    expect(state.status).toBe("ready");
    expect(state.effectiveModules.students).toBe(true);
    expect(state.effectiveModules.tasks).toBe(false);
    expect(state.evaluate("students", "read").allowed).toBe(true);
  });
});
