import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ActivityLogs } from "./ActivityLogs";
import { normalizeWorkspaceUser, type ActivityLog, type WorkspaceUser } from "@mms/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockUsers: WorkspaceUser[] = [
  normalizeWorkspaceUser({
    id: "u1",
    name: "Admin User",
    email: "admin@test.com",
    role: "admin",
    roles: ["admin"],
    status: "active",
  }),
  normalizeWorkspaceUser({
    id: "u2",
    name: "Staff Member",
    email: "staff@test.com",
    role: "staff",
    roles: ["staff"],
    status: "active",
  }),
];

const mockLogs: ActivityLog[] = [
  {
    id: "log1",
    userId: "u1",
    action: "create",
    module: "users",
    ip: "127.0.0.1",
    detail: "Created student record",
    ts: "2026-10-28T10:00:00Z",
  },
  {
    id: "log2",
    userId: "u2",
    action: "update",
    module: "users",
    ip: "127.0.0.1",
    detail: "Updated attendance",
    ts: "2026-10-28T11:00:00Z",
  },
];

describe("ActivityLogs", () => {
  it("renders log rows and does not enter a React 301 loop on re-render", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ActivityLogs logs={mockLogs} users={mockUsers} />);
    });

    expect(container.textContent).toContain("Created student record");
    expect(container.textContent).toContain("Updated attendance");

    // Re-render with new array references (simulating TanStack Query updates or parent re-renders)
    act(() => {
      root.render(<ActivityLogs logs={[...mockLogs]} users={[...mockUsers]} />);
    });

    // Verify it cleanly renders without throwing React error 301
    expect(container.textContent).toContain("Created student record");
    expect(container.textContent).toContain("Updated attendance");

    act(() => root.unmount());
    container.remove();
  });
});
