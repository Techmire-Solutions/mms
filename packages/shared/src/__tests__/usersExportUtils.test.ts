import { describe, expect, it } from "vitest";
import {
  DEFAULT_USER_EXPORT_COLUMNS,
  resolveAllUserExportColumns,
  mergeCustomUserExportColumns,
  filterUserExportColumnsForViewer,
  extractUserCell,
  buildUsersExportRows,
  type UserExportColumn,
} from "../auth/usersExportUtils.js";
import type { WorkspaceUser } from "../auth/userEntityTypes.js";

describe("usersExportUtils", () => {
  const sampleUser: WorkspaceUser = {
    id: "user-1",
    name: "Zainab Fatima",
    email: "zainab@madrasa.org",
    loginEmail: "zainab.auth@madrasa.org",
    role: "teacher",
    roleSource: "manual",
    status: "active",
    phone: "+923001234567",
    twoFactorEnabled: true,
    mustChangePassword: false,
    lastLogin: "2026-03-01T08:30:00Z",
    createdDate: "2026-01-15T10:00:00Z",
    failedLoginAttempts: 0,
    activeSessions: 2,
    avatarInitials: "ZF",
    emailVerifiedAt: "2026-01-15T10:05:00Z",
    customFields: {
      department: "Academics",
      notes: { supervisor: "Principal" },
    },
  };

  it("resolves all columns covering identity, roles, security, and activity", () => {
    const all = resolveAllUserExportColumns();
    const ids = all.map((c) => c.id);
    expect(ids).toContain("name");
    expect(ids).toContain("email");
    expect(ids).toContain("loginEmail");
    expect(ids).toContain("role");
    expect(ids).toContain("roleSource");
    expect(ids).toContain("status");
    expect(ids).toContain("phone");
    expect(ids).toContain("twoFactorEnabled");
    expect(ids).toContain("mustChangePassword");
    expect(ids).toContain("lastLogin");
    expect(ids).toContain("createdDate");
    expect(ids).toContain("failedLoginAttempts");
    expect(ids).toContain("activeSessions");
    expect(ids).toContain("emailVerifiedAt");
  });

  it("merges custom columns into user export column list", () => {
    const merged = mergeCustomUserExportColumns(
      [...DEFAULT_USER_EXPORT_COLUMNS],
      [{ id: "customDepartment", label: "Department" }],
    );
    expect(merged.some((c) => c.id === "customDepartment")).toBe(true);
  });

  it("filters columns and defaults to all columns when empty", () => {
    const resolved = filterUserExportColumnsForViewer([]);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.some((c) => c.id === "email")).toBe(true);
  });

  it("extracts cells from all tabs, security flags, and custom fields non-destructively", () => {
    expect(extractUserCell(sampleUser, "name")).toBe("Zainab Fatima");
    expect(extractUserCell(sampleUser, "email")).toBe("zainab@madrasa.org");
    expect(extractUserCell(sampleUser, "loginEmail")).toBe("zainab.auth@madrasa.org");
    expect(extractUserCell(sampleUser, "role")).toBe("teacher");
    expect(extractUserCell(sampleUser, "roleSource")).toBe("manual");
    expect(extractUserCell(sampleUser, "twoFactorEnabled")).toBe("yes");
    expect(extractUserCell(sampleUser, "mustChangePassword")).toBe("no");
    expect(extractUserCell(sampleUser, "activeSessions")).toBe("2");
    expect(extractUserCell(sampleUser, "department")).toBe("Academics");
    expect(extractUserCell(sampleUser, "notes")).toBe('{"supervisor":"Principal"}');
  });

  it("builds CSV export grid correctly", () => {
    const columns: UserExportColumn[] = [
      { id: "name", label: "User" },
      { id: "role", label: "Role" },
      { id: "twoFactorEnabled", label: "2FA" },
    ];
    const grid = buildUsersExportRows([sampleUser], columns);
    expect(grid).toHaveLength(2);
    expect(grid[0]).toEqual(["User", "Role", "2FA"]);
    expect(grid[1]).toEqual(["Zainab Fatima", "teacher", "yes"]);
  });
});
