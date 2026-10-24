import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWhere = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
  delete: mockDelete,
  transaction: vi.fn(async (cb) => cb(mockDb)),
  execute: vi.fn(),
};

vi.mock("../db/dbClient.js", () => ({
  getDb: () => mockDb,
}));

vi.mock("../db/dbConnection.js", () => ({
  activeDb: () => mockDb,
  getRootDb: () => mockDb,
  getReadReplicaDb: () => mockDb,
  hasActiveTransaction: () => false,
  // nested withTenant joins the ALS-registered transaction in production;
  // in these stubbed tests it runs the callback directly.
  withActiveTransaction: async (_tx: unknown, cb: () => Promise<unknown>) => await cb(),
}));

import {
  findTenantUserRowById,
  listTenantUsersByIds,
  replaceTenantUsersForWorkspace,
  softDeleteTenantUserRow,
  upsertTenantUserRow,
} from "../db/repositories/tenantUserRepository.js";

const existingDbRow = {
  id: "u-1",
  workspaceSubdomain: "dar-ul-quran",
  loginEmail: "teacher@workspace.local",
  passwordHash: "salt:existing-hash",
  name: "Existing Teacher",
  role: "teacher",
  contactId: "c-1",
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  pendingLoginEmail: null,
  mustChangePassword: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  deletedBy: null,
  profileJson: null,
};

describe("upsertTenantUserRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockSelectWhere.mockResolvedValue([existingDbRow]);
    mockWhere.mockResolvedValue(undefined);
  });

  it("preserves name, loginEmail, and passwordHash when contact-linked payload blanks them", async () => {
    await upsertTenantUserRow("dar-ul-quran", {
      id: "u-1",
      workspaceSubdomain: "dar-ul-quran",
      contactId: "c-1",
      role: "teacher",
      // Stripped contact profile fields + missing auth credentials
      name: "",
      loginEmail: "",
      passwordHash: "",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Existing Teacher",
        loginEmail: "teacher@workspace.local",
        passwordHash: "salt:existing-hash",
        workspaceSubdomain: "dar-ul-quran",
      }),
    );
  });

  it("keeps the existing workspace subdomain (rejects reassignment)", async () => {
    // The tenant argument is authoritative: a payload claiming another
    // workspace must not move the row.
    await upsertTenantUserRow("dar-ul-quran", {
      id: "u-1",
      workspaceSubdomain: "other-tenant",
      loginEmail: "teacher@workspace.local",
      passwordHash: "salt:existing-hash",
      name: "Existing Teacher",
      role: "teacher",
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "dar-ul-quran",
      }),
    );
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it("applies non-empty name and loginEmail updates", async () => {
    await upsertTenantUserRow("dar-ul-quran", {
      id: "u-1",
      workspaceSubdomain: "dar-ul-quran",
      name: "Updated Name",
      loginEmail: "new.login@workspace.local",
      passwordHash: "salt:existing-hash",
      role: "teacher",
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated Name",
        loginEmail: "new.login@workspace.local",
      }),
    );
  });
});

describe("replaceTenantUsersForWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockSelectWhere.mockResolvedValue([existingDbRow]);
  });

  it("carries the stored password hash forward when the backup payload omits it", async () => {
    await replaceTenantUsersForWorkspace("dar-ul-quran", [
      {
        id: "u-1",
        workspaceSubdomain: "dar-ul-quran",
        loginEmail: "teacher@workspace.local",
        name: "Existing Teacher",
        role: "teacher",
      },
    ]);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    const inserted = mockInsertValues.mock.calls[0]?.[0] as Array<{ passwordHash: string }>;
    expect(inserted[0].passwordHash).toBe("salt:existing-hash");
  });

  it("matches by login email when the backup carries a different user id", async () => {
    await replaceTenantUsersForWorkspace("dar-ul-quran", [
      {
        id: "u-restored",
        workspaceSubdomain: "dar-ul-quran",
        loginEmail: "Teacher@Workspace.local",
        name: "Existing Teacher",
        role: "teacher",
      },
    ]);

    const inserted = mockInsertValues.mock.calls[0]?.[0] as Array<{ passwordHash: string }>;
    expect(inserted[0].passwordHash).toBe("salt:existing-hash");
  });

  it("keeps an explicit password hash from the payload", async () => {
    await replaceTenantUsersForWorkspace("dar-ul-quran", [
      {
        id: "u-1",
        workspaceSubdomain: "dar-ul-quran",
        loginEmail: "teacher@workspace.local",
        passwordHash: "salt:payload-hash",
        name: "Existing Teacher",
        role: "teacher",
      },
    ]);

    const inserted = mockInsertValues.mock.calls[0]?.[0] as Array<{ passwordHash: string }>;
    expect(inserted[0].passwordHash).toBe("salt:payload-hash");
  });

  it("rejects restore when no live admin keeps a usable password hash", async () => {
    mockSelectWhere.mockResolvedValue([]);

    await expect(
      replaceTenantUsersForWorkspace("dar-ul-quran", [
        {
          id: "u-new",
          workspaceSubdomain: "dar-ul-quran",
          loginEmail: "new@workspace.local",
          name: "New User",
          role: "teacher",
        },
      ]),
    ).rejects.toMatchObject({
      message: "backup.missingUserCredentials",
      statusCode: 400,
      type: "validation_error",
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("parks an unusable hash for unknown users while an admin credential survives", async () => {
    mockSelectWhere.mockResolvedValue([
      { ...existingDbRow, id: "u-admin", loginEmail: "admin@workspace.local", role: "admin" },
    ]);

    await replaceTenantUsersForWorkspace("dar-ul-quran", [
      {
        id: "u-admin",
        workspaceSubdomain: "dar-ul-quran",
        loginEmail: "admin@workspace.local",
        name: "Workspace Admin",
        role: "admin",
      },
      {
        id: "u-unknown",
        workspaceSubdomain: "dar-ul-quran",
        loginEmail: "unknown@workspace.local",
        name: "Unknown User",
        role: "teacher",
      },
    ]);

    const inserted = mockInsertValues.mock.calls[0]?.[0] as Array<{
      id: string;
      passwordHash: string;
      mustChangePassword: boolean;
    }>;
    expect(inserted[0]).toMatchObject({
      id: "u-admin",
      passwordHash: "salt:existing-hash",
      mustChangePassword: false,
    });
    expect(inserted[1]?.mustChangePassword).toBe(true);
    expect(inserted[1]?.passwordHash).toMatch(/^!restore-/);
    // No `salt:hash` separator, so `verifyPassword` can never accept a parked hash.
    expect(inserted[1]?.passwordHash).not.toContain(":");
  });
});

/**
 * Collects the bound parameter values and column names from a Drizzle `SQL`
 * clause, so a test can assert what actually reaches Postgres.
 */
function collectSqlParts(clause: unknown): { columns: string[]; params: unknown[] } {
  const columns: string[] = [];
  const params: unknown[] = [];
  const walk = (node: unknown, depth = 0): void => {
    if (!node || typeof node !== "object" || depth > 8) return;
    const asRecord = node as Record<string, unknown>;
    if (typeof asRecord.name === "string" && "columnType" in asRecord) {
      columns.push(asRecord.name);
      return;
    }
    if ("value" in asRecord && !("queryChunks" in asRecord)) {
      params.push(asRecord.value);
      return;
    }
    if (Array.isArray(asRecord.queryChunks)) {
      for (const chunk of asRecord.queryChunks) walk(chunk, depth + 1);
    }
  };
  walk(clause);
  return { columns, params };
}

/**
 * Regression tests for the cross-tenant `tenant_users` read/write break.
 *
 * `tenant_users` is protected by a row-level security policy that matches every
 * row whenever `app.rls_bypass = 'on'`, and that flag is set for any transaction
 * opened without a tenant. An id-only lookup is therefore NOT implicitly
 * tenant-safe: the workspace predicate has to be in the query itself.
 */
describe("tenantUsers workspace scoping (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue(undefined);
    mockSelectWhere.mockResolvedValue([]);
  });

  it("findTenantUserRowById scopes the query to the caller workspace", async () => {
    await findTenantUserRowById("dar-ul-quran", "u-1");

    expect(mockSelectWhere).toHaveBeenCalledTimes(1);
    const { columns, params } = collectSqlParts(mockSelectWhere.mock.calls[0]?.[0]);
    expect(columns).toContain("workspace_subdomain");
    expect(params).toContain("dar-ul-quran");
    expect(params).toContain("u-1");
  });

  it("listTenantUsersByIds scopes the query to the caller workspace", async () => {
    await listTenantUsersByIds("dar-ul-quran", ["u-1", "u-2"]);

    expect(mockSelectWhere).toHaveBeenCalledTimes(1);
    const { columns, params } = collectSqlParts(mockSelectWhere.mock.calls[0]?.[0]);
    expect(columns).toContain("workspace_subdomain");
    expect(params).toContain("dar-ul-quran");
  });

  it("refuses to read without a workspace instead of falling back to an unscoped query", async () => {
    await expect(findTenantUserRowById("", "u-1")).resolves.toBeNull();
    await expect(listTenantUsersByIds("", ["u-1"])).resolves.toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("softDeleteTenantUserRow refuses to write without a workspace", async () => {
    await expect(softDeleteTenantUserRow("", "u-1", "u-admin")).resolves.toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("softDeleteTenantUserRow scopes the UPDATE to the caller workspace", async () => {
    mockSelectWhere.mockResolvedValue([existingDbRow]);

    await softDeleteTenantUserRow("dar-ul-quran", "u-1", "u-admin");

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
    const { columns, params } = collectSqlParts(mockWhere.mock.calls[0]?.[0]);
    expect(columns).toContain("workspace_subdomain");
    expect(params).toContain("dar-ul-quran");
  });
});
