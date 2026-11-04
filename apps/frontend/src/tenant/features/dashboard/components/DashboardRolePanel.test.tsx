import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const quickActions = vi.hoisted(() => ({ current: [] as Array<{ id: string }> }));

vi.mock("@/tenant/features/dashboard/hooks/useDashboardQuickActions", () => ({
  useDashboardQuickActions: () => quickActions.current,
}));
vi.mock("@/tenant/hooks/notifications/useOpenTenantNotification", () => ({
  useOpenTenantNotification: () => vi.fn(),
}));
vi.mock("@/tenant/hooks/notifications/useNotificationReadState", () => ({
  useNotificationReadState: () => ({ markRead: vi.fn() }),
}));
vi.mock("@/tenant/features/dashboard/components/NotificationsPanel", () => ({
  default: () => <div data-testid="notifications-panel" />,
}));
vi.mock("@/tenant/features/dashboard/components/QuickActionsPanel", () => ({
  default: () => <div data-testid="quick-actions-panel" />,
}));

import DashboardRolePanel from "./DashboardRolePanel";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DashboardRolePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    quickActions.current = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = () =>
    act(() => {
      root.render(<DashboardRolePanel dashboardRole="admin" notifications={[]} />);
    });

  it("gives notifications the full row when no quick action is permitted", () => {
    render();

    expect(container.querySelector("[data-testid='quick-actions-panel']")).toBeNull();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toBe("grid grid-cols-1 gap-4");
  });

  it("keeps the two-thirds quick-actions split when actions exist", () => {
    quickActions.current = [{ id: "add-student" }];
    render();

    expect(container.querySelector("[data-testid='quick-actions-panel']")).not.toBeNull();
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain("lg:grid-cols-3");
    expect(grid.firstElementChild?.className).toContain("lg:col-span-2");
  });
});
