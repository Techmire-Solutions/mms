import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardQuickAction } from "@/lib/dashboardQuickActions";
import type { DashboardRole } from "@/lib/dashboardRole";

const state = vi.hoisted(() => ({
  evaluate: vi.fn(),
  can: vi.fn(),
}));

vi.mock("@/tenant/hooks/useModuleAccess", () => ({
  useModuleAccess: () => ({ evaluate: state.evaluate }),
}));
vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: state.can }),
}));

import { useDashboardQuickActions } from "./useDashboardQuickActions";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let latest: DashboardQuickAction[] = [];

function Probe({ role }: { role: DashboardRole }): null {
  latest = useDashboardQuickActions(role);
  return null;
}

describe("useDashboardQuickActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = [];
    state.evaluate.mockReset();
    state.can.mockReset();
    state.evaluate.mockReturnValue({ allowed: true });
    state.can.mockReturnValue(true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const renderRole = (role: DashboardRole) =>
    act(() => {
      root.render(<Probe role={role} />);
    });

  it("returns the role's actions when the module is available and permitted", () => {
    renderRole("accountant");

    expect(latest.map((action) => action.id)).toEqual([
      "record-payment",
      "view-accounting",
      "print-receipt",
      "view-ledger",
    ]);
  });

  it("drops actions whose module is unavailable", () => {
    state.evaluate.mockImplementation((moduleId: string) => ({
      allowed: moduleId !== "finance",
    }));

    renderRole("accountant");

    expect(latest.map((action) => action.id)).not.toContain("record-payment");
    expect(latest.map((action) => action.id)).not.toContain("print-receipt");
    expect(latest.map((action) => action.id)).toContain("view-ledger");
  });

  it("drops actions the caller may not perform", () => {
    state.can.mockReturnValue(false);

    renderRole("admin");

    expect(latest).toEqual([]);
  });
});
