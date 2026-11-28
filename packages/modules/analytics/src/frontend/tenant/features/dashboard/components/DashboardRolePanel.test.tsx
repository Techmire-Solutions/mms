import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const quickActions = vi.hoisted(() => ({ current: [] as Array<{ id: string }> }));

vi.mock("../hooks/useDashboardQuickActions", () => ({
  useDashboardQuickActions: () => quickActions.current,
}));
vi.mock("../../../host/collections", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useOpenTenantNotification: () => vi.fn(),
}));
vi.mock("../../../host/collections", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useNotificationReadState: () => ({ markRead: vi.fn() }),
}));
vi.mock("./NotificationsPanel", () => ({
  default: () => <div data-testid="notifications-panel" />,
}));
const capturedQuickActionsProps = vi.hoisted(() => ({
  highlightedActionId: undefined as string | undefined,
}));

vi.mock("./QuickActionsPanel", () => ({
  default: (props: { highlightedActionId?: string }) => {
    capturedQuickActionsProps.highlightedActionId = props.highlightedActionId;
    return <div data-testid="quick-actions-panel" />;
  },
}));

import DashboardRolePanel from "./DashboardRolePanel";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("DashboardRolePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    quickActions.current = [];
    capturedQuickActionsProps.highlightedActionId = undefined;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = (notifications: any[] = []) =>
    act(() => {
      root.render(<DashboardRolePanel dashboardRole="admin" notifications={notifications} />);
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

  it("highlights the quick action that resolves the top urgent alert", () => {
    quickActions.current = [
      { id: "add-student" },
      { id: "take-attendance" },
      { id: "record-payment" },
    ];
    render([
      {
        id: "attendance-not-taken",
        type: "attendance",
        title: "Attendance not yet taken",
        desc: "No attendance recorded",
        time: "Today",
        urgent: false,
      },
      {
        id: "unpaid-invoices",
        type: "fee",
        title: "3 unpaid invoices",
        desc: "1000 outstanding",
        time: "Just now",
        urgent: true,
      },
    ]);

    expect(capturedQuickActionsProps.highlightedActionId).toBe("record-payment");
  });
});
