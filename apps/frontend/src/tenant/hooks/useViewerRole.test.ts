import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@mms/shared";
import {
  normalizeViewerRole,
  normalizeEnrollmentViewerRole,
  useViewerRole,
  useIsAdminViewer,
  useEnrollmentViewerRole,
} from "./useViewerRole";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockGrantedPermissions: Permission[] = [];

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (perm: Permission) => mockGrantedPermissions.includes(perm),
  }),
}));

describe("normalizeViewerRole", () => {
  it("defaults undefined to admin", () => {
    expect(normalizeViewerRole(undefined)).toBe("admin");
  });

  it("normalizes admin correctly", () => {
    expect(normalizeViewerRole("admin")).toBe("admin");
    expect(normalizeViewerRole("ADMIN")).toBe("admin");
  });

  it("normalizes faculty and staff to faculty", () => {
    expect(normalizeViewerRole("faculty")).toBe("faculty");
    expect(normalizeViewerRole("FACULTY")).toBe("faculty");
    expect(normalizeViewerRole("staff")).toBe("faculty");
    expect(normalizeViewerRole("STAFF")).toBe("faculty");
  });

  it("normalizes accountant correctly", () => {
    expect(normalizeViewerRole("accountant")).toBe("accountant");
    expect(normalizeViewerRole("ACCOUNTANT")).toBe("accountant");
  });

  it("falls back to admin for unknown role", () => {
    expect(normalizeViewerRole("unknown")).toBe("admin");
  });
});

describe("normalizeEnrollmentViewerRole", () => {
  it("maps faculty and staff to staff", () => {
    expect(normalizeEnrollmentViewerRole("faculty")).toBe("staff");
    expect(normalizeEnrollmentViewerRole("staff")).toBe("staff");
  });

  it("preserves admin and accountant", () => {
    expect(normalizeEnrollmentViewerRole("admin")).toBe("admin");
    expect(normalizeEnrollmentViewerRole("accountant")).toBe("accountant");
  });
});

describe("useViewerRole hooks", () => {
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

  it("resolves admin viewer role and isAdmin=true when users.manage is granted", async () => {
    mockGrantedPermissions = ["users.manage"];
    let roleResult: string | null = null;
    let isAdminResult: boolean | null = null;
    let enrollmentRoleResult: string | null = null;

    function TestComponent() {
      roleResult = useViewerRole();
      isAdminResult = useIsAdminViewer();
      enrollmentRoleResult = useEnrollmentViewerRole();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(roleResult).toBe("admin");
    expect(isAdminResult).toBe(true);
    expect(enrollmentRoleResult).toBe("admin");
  });

  it("resolves faculty viewer role and staff enrollment role for attendance write grant", async () => {
    mockGrantedPermissions = ["attendance.write"];
    let roleResult: string | null = null;
    let isAdminResult: boolean | null = null;
    let enrollmentRoleResult: string | null = null;

    function TestComponent() {
      roleResult = useViewerRole();
      isAdminResult = useIsAdminViewer();
      enrollmentRoleResult = useEnrollmentViewerRole();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(roleResult).toBe("faculty");
    expect(isAdminResult).toBe(false);
    expect(enrollmentRoleResult).toBe("staff");
  });

  it("resolves accountant viewer role for finance write grant", async () => {
    mockGrantedPermissions = ["finance.write"];
    let roleResult: string | null = null;
    let isAdminResult: boolean | null = null;
    let enrollmentRoleResult: string | null = null;

    function TestComponent() {
      roleResult = useViewerRole();
      isAdminResult = useIsAdminViewer();
      enrollmentRoleResult = useEnrollmentViewerRole();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(roleResult).toBe("accountant");
    expect(isAdminResult).toBe(false);
    expect(enrollmentRoleResult).toBe("accountant");
  });
});
