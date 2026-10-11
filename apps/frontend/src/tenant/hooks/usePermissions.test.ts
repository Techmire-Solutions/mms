import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRole } from "@mms/shared";
import {
  useModulePermissions,
  usePermissions,
  type ModulePermissionsManifest,
} from "./usePermissions";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockAuthUser: { role?: string } | null = { role: "admin" };
let mockWorkspaceRoles: WorkspaceRole[] = [];

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => mockWorkspaceRoles,
}));

describe("usePermissions", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("returns full permissions and isAdmin=true for admin role", async () => {
    mockAuthUser = { role: "admin" };
    mockWorkspaceRoles = [];
    let hookResult: ReturnType<typeof usePermissions> | null = null;

    function TestComponent() {
      hookResult = usePermissions();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult!.role).toBe("admin");
    expect(hookResult!.isAdmin).toBe(true);
    expect(hookResult!.can("students.write")).toBe(true);
    expect(hookResult!.can("users.manage")).toBe(true);
    expect(hookResult!.canAny("students.write", "finance.write")).toBe(true);
    expect(hookResult!.canAll("students.write", "finance.write", "users.manage")).toBe(true);
    expect(hookResult!.permissions.length).toBeGreaterThan(30);
  });

  it("evaluates teacher role with restricted permissions and isAdmin=false", async () => {
    mockAuthUser = { role: "teacher" };
    mockWorkspaceRoles = [];
    let hookResult: ReturnType<typeof usePermissions> | null = null;

    function TestComponent() {
      hookResult = usePermissions();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult!.role).toBe("teacher");
    expect(hookResult!.isAdmin).toBe(false);
    expect(hookResult!.can("students.read")).toBe(true);
    expect(hookResult!.can("students.write")).toBe(true);
    expect(hookResult!.can("users.manage")).toBe(false);
    expect(hookResult!.can("finance.write")).toBe(false);
    expect(hookResult!.canAny("finance.write", "students.read")).toBe(true);
    expect(hookResult!.canAny("finance.write", "users.manage")).toBe(false);
    expect(hookResult!.canAll("students.read", "students.write")).toBe(true);
    expect(hookResult!.canAll("students.read", "finance.write")).toBe(false);
  });

  it("evaluates dynamic custom roles from workspaceRoles", async () => {
    mockAuthUser = { role: "custom_supervisor" };
    mockWorkspaceRoles = [
      {
        id: "custom_supervisor",
        labelKey: "users.role.custom",
        descriptionKey: "users.role.customDesc",
        customLabel: "Supervisor",
        isSystem: false,
        badgeVariant: "primary",
        permissions: {
          examinations: ["read", "create", "update"],
          students: ["read"],
        },
      },
    ];
    let hookResult: ReturnType<typeof usePermissions> | null = null;

    function TestComponent() {
      hookResult = usePermissions();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult!.role).toBe("custom_supervisor");
    expect(hookResult!.can("examinations.write")).toBe(true);
    expect(hookResult!.can("examinations.delete")).toBe(false);
    expect(hookResult!.can("students.read")).toBe(true);
    expect(hookResult!.can("students.write")).toBe(false);
    expect(hookResult!.isAdmin).toBe(false);
  });
});

describe("useModulePermissions", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("correctly derives module action booleans from manifest", async () => {
    mockAuthUser = { role: "teacher" };
    mockWorkspaceRoles = [];
    let hookResult: ReturnType<typeof useModulePermissions> | null = null;

    const manifest: ModulePermissionsManifest = {
      permissions: {
        read: "students.read",
        write: "students.write",
        delete: "students.delete",
        setupView: "students.read",
        setupWrite: "settings.global.write",
      },
    };

    function TestComponent() {
      hookResult = useModulePermissions(manifest);
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult!.canRead).toBe(true);
    expect(hookResult!.canWrite).toBe(true);
    expect(hookResult!.canDelete).toBe(false);
    expect(hookResult!.canViewSetup).toBe(true);
    expect(hookResult!.canEditSetup).toBe(false);
    expect(hookResult!.canExport).toBe(false);
  });
});
