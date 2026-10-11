import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { UsersModalLayer, type UsersModalLayerProps } from "./UsersModalLayer";
import { normalizeWorkspaceUser } from "@mms/shared";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/tenant/features/users/components/UserDetail", () => ({
  UserDetail: ({ user, onClose }: any) => (
    <div data-testid="user-detail">
      <span>{user.name}</span>
      <button onClick={onClose}>Close Detail</button>
    </div>
  ),
}));

vi.mock("@/tenant/features/users/components/EditUserModal", () => ({
  EditUserModal: ({ user, onClose }: any) => (
    <div data-testid="edit-user-modal">
      <span>{user.name}</span>
      <button onClick={onClose}>Close Edit</button>
    </div>
  ),
}));

vi.mock("@/tenant/features/users/components/ResetUserPasswordModal", () => ({
  ResetUserPasswordModal: ({ user, onClose }: any) => (
    <div data-testid="reset-password-modal">
      <span>{user.name}</span>
      <button onClick={onClose}>Close Reset</button>
    </div>
  ),
}));

vi.mock("@/tenant/features/users/components/AddUserModal", () => ({
  AddUserModal: ({ onClose }: any) => (
    <div data-testid="add-user-modal">
      <button onClick={onClose}>Close Add</button>
    </div>
  ),
}));

vi.mock("@/tenant/features/users/components/InviteUserModal", () => ({
  InviteUserModal: ({ onClose }: any) => (
    <div data-testid="invite-user-modal">
      <button onClick={onClose}>Close Invite</button>
    </div>
  ),
}));

vi.mock("@/tenant/components/messaging/TenantMessageComposer", () => ({
  default: ({ onClose }: any) => (
    <div data-testid="message-composer">
      <button onClick={onClose}>Close Composer</button>
    </div>
  ),
}));

describe("UsersModalLayer", () => {
  const baseProps: UsersModalLayerProps = {
    viewing: null,
    editing: null,
    resettingPasswordFor: null,
    showAddUser: false,
    showInvite: false,
    canWrite: true,
    canDelete: true,
    users: [
      normalizeWorkspaceUser({ id: "u1", name: "User 1", email: "u1@test.com", role: "admin" }),
    ],
    messagingTarget: null,
    onCloseViewing: vi.fn(),
    onCloseEditing: vi.fn(),
    onClosePasswordReset: vi.fn(),
    onCloseAddUser: vi.fn(),
    onCloseInvite: vi.fn(),
    onSaveEdit: vi.fn(),
    onResetPassword: vi.fn(),
    onAddUser: vi.fn(),
    onInvite: vi.fn(),
    onRestoreUser: vi.fn(),
    onEditFromDetail: vi.fn(),
    onCloseComposer: vi.fn(),
  };

  it("renders nothing when no modal or drawer is active", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UsersModalLayer {...baseProps} />);
    });

    expect(container.querySelector('[data-testid="user-detail"]')).toBeNull();
    expect(container.querySelector('[data-testid="edit-user-modal"]')).toBeNull();
    expect(container.querySelector('[data-testid="reset-password-modal"]')).toBeNull();
    expect(container.querySelector('[data-testid="add-user-modal"]')).toBeNull();
    expect(container.querySelector('[data-testid="invite-user-modal"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("renders UserDetail when viewing is set", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UsersModalLayer {...baseProps} viewing={baseProps.users[0] ?? null} />);
    });

    expect(container.querySelector('[data-testid="user-detail"]')).not.toBeNull();
    expect(container.textContent).toContain("User 1");

    act(() => {
      root.unmount();
    });
  });

  it("renders EditUserModal when editing is set and canWrite is true", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UsersModalLayer {...baseProps} editing={baseProps.users[0] ?? null} />);
    });

    expect(container.querySelector('[data-testid="edit-user-modal"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("renders AddUserModal when showAddUser is true", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UsersModalLayer {...baseProps} showAddUser={true} />);
    });

    expect(container.querySelector('[data-testid="add-user-modal"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("renders InviteUserModal when showInvite is true", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<UsersModalLayer {...baseProps} showInvite={true} />);
    });

    expect(container.querySelector('[data-testid="invite-user-modal"]')).not.toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
