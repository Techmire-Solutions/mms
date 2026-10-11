import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UsersRowActions } from "./UsersRowActions";
import { normalizeWorkspaceUser } from "@mms/shared";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let mockActor = { id: "actor-1", role: "admin" };

vi.mock("@/lib/contexts/AuthContext", () => ({
  useOptionalAuth: () => ({
    user: mockActor,
  }),
}));

describe("UsersRowActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor = { id: "actor-1", role: "admin" };
  });

  const baseUser = normalizeWorkspaceUser({
    id: "u-target",
    name: "Target User",
    email: "target@example.com",
    role: "teacher",
    status: "active",
  });

  it("renders all action buttons for a manageable target user", () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onResetPassword = vi.fn();
    const onDelete = vi.fn();
    const onRestore = vi.fn();

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UsersRowActions
          user={baseUser}
          canWrite={true}
          canDelete={true}
          showDeleted={false}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onResetPassword={onResetPassword}
        />,
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(4); // View, Edit, ResetPassword, Delete

    // Click View
    act(() => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onView).toHaveBeenCalledWith(baseUser);

    // Click Edit
    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onEdit).toHaveBeenCalledWith(baseUser);

    // Click Reset Password
    act(() => {
      buttons[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onResetPassword).toHaveBeenCalledWith(baseUser);

    // Click Delete
    act(() => {
      buttons[3]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDelete).toHaveBeenCalledWith("u-target");

    act(() => {
      root.unmount();
    });
  });

  it("hides edit, password reset, and delete actions for super admin when actor is standard admin", () => {
    mockActor = { id: "actor-admin", role: "admin" };
    const superAdminUser = normalizeWorkspaceUser({
      id: "u-super",
      name: "Super Admin User",
      email: "super@example.com",
      role: "super_admin",
      status: "active",
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UsersRowActions
          user={superAdminUser}
          canWrite={true}
          canDelete={true}
          showDeleted={false}
          onView={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          onResetPassword={vi.fn()}
        />,
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(1); // Only View button

    act(() => {
      root.unmount();
    });
  });

  it("hides delete action when viewing own account (self-delete guard)", () => {
    mockActor = { id: "u-self", role: "super_admin" };
    const selfUser = normalizeWorkspaceUser({
      id: "u-self",
      name: "Self User",
      email: "self@example.com",
      role: "super_admin",
      status: "active",
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UsersRowActions
          user={selfUser}
          canWrite={true}
          canDelete={true}
          showDeleted={false}
          onView={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          onResetPassword={vi.fn()}
        />,
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(3); // View, Edit, ResetPassword (No Delete)

    act(() => {
      root.unmount();
    });
  });

  it("renders restore button and triggers onRestore when showDeleted is true", () => {
    const onRestore = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UsersRowActions
          user={baseUser}
          canWrite={true}
          canDelete={true}
          showDeleted={true}
          onView={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onRestore={onRestore}
          onResetPassword={vi.fn()}
        />,
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2); // View, Restore

    act(() => {
      buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRestore).toHaveBeenCalledWith("u-target");

    act(() => {
      root.unmount();
    });
  });

  it("hides view button when hideViewItem is true", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <UsersRowActions
          user={baseUser}
          canWrite={true}
          canDelete={true}
          showDeleted={false}
          hideViewItem={true}
          onView={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          onResetPassword={vi.fn()}
        />,
      );
    });

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(3); // Edit, ResetPassword, Delete (No View)

    act(() => {
      root.unmount();
    });
  });
});
