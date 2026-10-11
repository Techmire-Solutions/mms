import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useUsersPageController } from "./useUsersPageController";
import { normalizeWorkspaceUser } from "@mms/shared";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: {
    id: "admin-1",
    name: "Admin",
    email: "admin@test.com",
    role: "admin",
    workspaceSubdomain: "demo",
    twoFactorEnabled: false,
  },
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthUser,
    isAuthenticated: true,
  }),
}));

// Default roles, as the hook returns when no custom roles are configured;
// unmocked it fetches users config from the backend during the test.
vi.mock("@/tenant/hooks/useWorkspaceRoles", async () => {
  const { cloneDefaultWorkspaceRoles } = await import("@mms/shared");
  return { useWorkspaceRoles: () => cloneDefaultWorkspaceRoles() };
});

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/tenant/features/users/hooks/useUsersApi", () => ({
  extractActivityLogs: (data: any) => data?.body ?? [],
  useActivityLogs: () => ({
    data: {
      status: 200,
      body: [{ id: "log-1", userId: "u1", action: "create", timestamp: "2026-09-01" }],
    },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useUsersByIds: () => ({
    data: [{ id: "u1", name: "User 1", email: "u1@test.com", role: "teacher" }],
    isLoading: false,
  }),
  useUsersMutations: () => ({
    logExportAudit: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/users/hooks/useUsersListQueries", () => ({
  useUsersPaginated: () => ({
    data: {
      users: [
        { id: "u1", name: "User 1", email: "u1@test.com", role: "teacher" },
        { id: "sa-1", name: "Super Admin", email: "sa@test.com", role: "super_admin" },
      ],
      total: 2,
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("useUsersPageController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("initializes controller state and derives logs from single activity query", () => {
    let controller: ReturnType<typeof useUsersPageController> = undefined as any;
    function Consumer() {
      controller = useUsersPageController();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter>
          <Consumer />
        </MemoryRouter>,
      );
    });

    expect(controller).toBeDefined();
    expect(controller.workTierProps.users.length).toBe(2);
    expect(controller.workTierProps.logs.length).toBe(1);
    expect(controller.workTierProps.logs[0]?.id).toBe("log-1");
    expect(controller.workTierProps.activityUsers?.[0]?.id).toBe("u1");

    act(() => {
      root.unmount();
    });
  });

  it("guards editing Super Admin when actor is standard Admin", async () => {
    const { notify } = await import("@/lib/notify");
    let controller: ReturnType<typeof useUsersPageController> = undefined as any;
    function Consumer() {
      controller = useUsersPageController();
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter>
          <Consumer />
        </MemoryRouter>,
      );
    });

    const superAdminUser = normalizeWorkspaceUser({
      id: "sa-1",
      name: "Super Admin",
      email: "sa@test.com",
      role: "super_admin",
    });

    act(() => {
      controller.workTierProps.onEditUser(superAdminUser);
    });

    expect(notify.error).toHaveBeenCalledWith("users.errors.cannotModifySuperAdmin");
    expect(controller.modalLayerProps.editing).toBeNull();

    const standardUser = normalizeWorkspaceUser({
      id: "u1",
      name: "Teacher User",
      email: "teacher@test.com",
      role: "teacher",
    });

    act(() => {
      controller.workTierProps.onEditUser(standardUser);
    });

    expect(controller.modalLayerProps.editing).toEqual(standardUser);

    act(() => {
      root.unmount();
    });
  });
});
