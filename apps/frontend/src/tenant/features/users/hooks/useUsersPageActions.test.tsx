import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useUsersPageActions } from "./useUsersPageActions";
import { normalizeWorkspaceUser } from "@mms/shared";
import { notify } from "@/lib/notify";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockDeleteUser = { mutateAsync: vi.fn() };
const mockRestoreUser = { mutateAsync: vi.fn() };
const mockBulkDeleteUsers = { mutateAsync: vi.fn() };
const mockBulkRestoreUsers = { mutateAsync: vi.fn() };
const mockResetPassword = { mutateAsync: vi.fn() };
const mockUpdateUser = { mutateAsync: vi.fn() };
const mockInviteUser = { mutateAsync: vi.fn() };
const mockCreateUser = { mutateAsync: vi.fn() };

vi.mock("@/tenant/features/users/hooks/useUsersApi", () => ({
  useUsersMutations: () => ({
    deleteUser: mockDeleteUser,
    restoreUser: mockRestoreUser,
    bulkDeleteUsers: mockBulkDeleteUsers,
    bulkRestoreUsers: mockBulkRestoreUsers,
    resetPassword: mockResetPassword,
    updateUser: mockUpdateUser,
    inviteUser: mockInviteUser,
    createUser: mockCreateUser,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

function renderTestHook<T>(hookFn: () => T): { result: { current: T }; unmount: () => void } {
  const result = { current: null as unknown as T };
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(<TestComponent />);
  });
  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("useUsersPageActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const t = ((key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key) as unknown as never;

  const sampleUser = normalizeWorkspaceUser({
    id: "u1",
    name: "Sample User",
    email: "user@example.com",
    role: "teacher",
    status: "active",
  });

  it("handles single delete and restore operations", async () => {
    mockDeleteUser.mutateAsync.mockResolvedValueOnce(undefined);
    mockRestoreUser.mutateAsync.mockResolvedValueOnce(undefined);

    const { result, unmount } = renderTestHook(() => useUsersPageActions({ t }));

    await result.current.handleDeleteUser("u1");
    expect(mockDeleteUser.mutateAsync).toHaveBeenCalledWith("u1");
    expect(notify.success).toHaveBeenCalledWith("users.trash.deleted");

    await result.current.handleRestoreUser("u1");
    expect(mockRestoreUser.mutateAsync).toHaveBeenCalledWith("u1");
    expect(notify.success).toHaveBeenCalledWith("users.trash.restored");

    unmount();
  });

  it("handles bulk delete and bulk restore operations with partial failure warnings", async () => {
    mockBulkDeleteUsers.mutateAsync.mockResolvedValueOnce({ succeeded: 2, failed: 1 });
    mockBulkRestoreUsers.mutateAsync.mockResolvedValueOnce({ succeeded: 3, failed: 0 });

    const { result, unmount } = renderTestHook(() => useUsersPageActions({ t }));

    await result.current.handleBulkDelete(["u1", "u2", "u3"]);
    expect(mockBulkDeleteUsers.mutateAsync).toHaveBeenCalledWith(["u1", "u2", "u3"]);
    expect(notify.warning).toHaveBeenCalled();

    await result.current.handleBulkRestore(["u1", "u2", "u3"]);
    expect(mockBulkRestoreUsers.mutateAsync).toHaveBeenCalledWith(["u1", "u2", "u3"]);
    expect(notify.success).toHaveBeenCalledWith("users.trash.restored");

    unmount();
  });

  it("handles password reset and notifies success", async () => {
    mockResetPassword.mutateAsync.mockResolvedValueOnce({});

    const { result, unmount } = renderTestHook(() => useUsersPageActions({ t }));

    await result.current.handleResetPassword(sampleUser, "TempPass123!");
    expect(mockResetPassword.mutateAsync).toHaveBeenCalledWith({
      userId: "u1",
      temporaryPassword: "TempPass123!",
    });
    expect(notify.success).toHaveBeenCalled();

    unmount();
  });

  it("handles save edit, invite, and create user mutations", async () => {
    mockUpdateUser.mutateAsync.mockResolvedValueOnce({});
    mockInviteUser.mutateAsync.mockResolvedValueOnce({});
    mockCreateUser.mutateAsync.mockResolvedValueOnce({});

    const { result, unmount } = renderTestHook(() => useUsersPageActions({ t }));

    await result.current.handleSaveEdit(sampleUser);
    expect(mockUpdateUser.mutateAsync).toHaveBeenCalledWith({
      id: "u1",
      data: sampleUser,
    });
    expect(notify.success).toHaveBeenCalledWith("users.saveChanges");

    await result.current.handleInvite(sampleUser);
    expect(mockInviteUser.mutateAsync).toHaveBeenCalledWith(sampleUser);
    expect(notify.success).toHaveBeenCalledWith("users.addSuccessTitle");

    await result.current.handleAddUser(sampleUser);
    expect(mockCreateUser.mutateAsync).toHaveBeenCalledWith(sampleUser);
    expect(notify.success).toHaveBeenCalledWith("users.addSuccessTitle");

    unmount();
  });
});
