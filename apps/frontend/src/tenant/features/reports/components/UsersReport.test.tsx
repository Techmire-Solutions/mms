import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import UsersReport from "./UsersReport";
import { normalizeWorkspaceUser, type ActivityLog, type WorkspaceUser } from "@mms/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockLogs: ActivityLog[] = [
  {
    id: "l1",
    userId: "u1",
    action: "create",
    module: "users",
    ip: "127.0.0.1",
    detail: "Added student",
    ts: "2026-10-28T12:00:00Z",
  },
];

const mockUsers: WorkspaceUser[] = [
  normalizeWorkspaceUser({
    id: "u1",
    name: "Test Admin",
    email: "admin@test.com",
    role: "admin",
    roles: ["admin"],
    status: "active",
  }),
];

let activityQueryData: { status: number; body: { logs: ActivityLog[] } } = {
  status: 200,
  body: { logs: mockLogs },
};

vi.mock("@/tenant/hooks/collections/users", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActivityLogs: () => ({
      data: activityQueryData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useUsersByIds: () => ({
      data: mockUsers,
      isLoading: false,
      isError: false,
    }),
  };
});

vi.mock("@/tenant/components/reports/moduleReportAdapters", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    UsersCommandMetrics: ({ shown }: { shown: number }) => <div>Shown: {shown}</div>,
  };
});

vi.mock("@/tenant/features/reports/components/PinnedWidgets", () => ({
  default: () => <div data-testid="pinned-widgets" />,
}));

describe("UsersReport", () => {
  it("renders activity logs and metrics without render loop", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<UsersReport />);
    });

    expect(container.textContent).toContain("Added student");

    // Simulate query updates with fresh references
    activityQueryData = {
      status: 200,
      body: { logs: [...mockLogs] },
    };

    act(() => {
      root.render(<UsersReport />);
    });

    expect(container.textContent).toContain("Added student");

    act(() => root.unmount());
    container.remove();
  });
});
