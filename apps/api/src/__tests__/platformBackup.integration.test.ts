import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLATFORM_SETTINGS } from "@mms/contracts";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { mockSuperUser } = vi.hoisted(() => ({
  mockSuperUser: {
    id: "p-super",
    email: "admin@platform.com",
    name: "Super Admin",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "super_user" as const,
    permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
}));

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mms/mod-platform/backend/platform/repository/db/platformUserRepository", () => ({
  findPlatformUserRowById: vi.fn().mockResolvedValue(mockSuperUser),
  findPlatformUserRowByEmail: vi.fn().mockResolvedValue(mockSuperUser),
  listPlatformUsers: vi.fn().mockResolvedValue([mockSuperUser]),
  insertPlatformUser: vi.fn(),
  deletePlatformUserRow: vi.fn(),
}));

vi.mock("@mms/mod-platform/backend/platform/repository/db/platformActivityLogsRepository", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@mms/mod-platform/backend/platform/services/platformSettingsService", () => ({
  getPlatformSettings: vi.fn().mockReturnValue(DEFAULT_PLATFORM_SETTINGS),
  maskPlatformSettingsForClient: vi.fn().mockImplementation((settings: unknown) => settings),
  updatePlatformSettings: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_SETTINGS),
}));

vi.mock(
  "@mms/mod-platform/backend/platform/services/platformUserService",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@mms/mod-platform/backend/platform/services/platformUserService")
      >();
    return {
      ...actual,
      verifyPlatformUserPassword: vi
        .fn()
        .mockImplementation(
          async (_id: string, password: string) => password === "correct-password",
        ),
    };
  },
);

vi.mock("@mms/mod-platform/backend/platform/services/platformBackupService", () => ({
  exportPlatformConfigBackup: vi.fn().mockResolvedValue({
    fileName: "platform-config-2026-01-01.mmsbackup.json",
    file: '{"format":"mms-encrypted-platform-config-backup"}',
  }),
  importPlatformConfigBackup: vi.fn().mockImplementation(async (input: { file: string }) => {
    if (input.file === "tampered") {
      throw Object.assign(new Error("backup.invalidFormat"), {
        statusCode: 400,
        type: "validation_error",
      });
    }
    return {
      applied: { settings: false, branding: false },
      notApplied: { workspaces: 2, admins: 1 },
      warnings: ["Workspace and admin registry sections are informational only."],
    };
  }),
}));

import { insertPlatformActivityLog } from "@mms/mod-platform/backend/platform/repository/db/platformActivityLogsRepository";
import { importPlatformConfigBackup } from "@mms/mod-platform/backend/platform/services/platformBackupService";

const mockAudit = vi.mocked(insertPlatformActivityLog);
const mockImport = vi.mocked(importPlatformConfigBackup);

describe("platform configuration backup routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({
    headers: { origin: "http://localhost" },
    cookies: {
      mms_platform_access: app.jwt.sign({
        id: mockSuperUser.id,
        email: mockSuperUser.email,
        name: mockSuperUser.name,
        role: mockSuperUser.role,
        permissions: mockSuperUser.permissions,
        sessionVersion: mockSuperUser.sessionVersion,
        tokenType: "platform_access",
      }),
    },
  });

  it("rejects an export encrypted for another email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/backup/export",
      ...auth(),
      payload: { email: "other@platform.com", password: "correct-password" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects a wrong step-up password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/backup/export",
      ...auth(),
      payload: { email: "admin@platform.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("exports an encrypted configuration snapshot and audits it", async () => {
    mockAudit.mockClear();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/backup/export",
      ...auth(),
      payload: { email: "admin@platform.com", password: "correct-password" },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      fileName: "platform-config-2026-01-01.mmsbackup.json",
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "export_platform_backup" }),
    );
  });

  it("validates a backup without applying it and does not audit a dry run", async () => {
    mockAudit.mockClear();
    mockImport.mockClear();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/backup/import",
      ...auth(),
      payload: {
        file: "encrypted",
        email: "admin@platform.com",
        password: "correct-password",
        dryRun: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      applied: { settings: false, branding: false },
      notApplied: { workspaces: 2, admins: 1 },
    });
    expect(mockImport).toHaveBeenCalledWith(
      expect.objectContaining({ file: "encrypted", dryRun: true }),
    );
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("audits an applied backup import", async () => {
    mockAudit.mockClear();
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/backup/import",
      ...auth(),
      payload: {
        file: "encrypted",
        email: "admin@platform.com",
        password: "correct-password",
        dryRun: false,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "import_platform_backup" }),
    );
  });

  it("returns 400 for a malformed/tampered backup", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/backup/import",
      ...auth(),
      payload: {
        file: "tampered",
        email: "admin@platform.com",
        password: "correct-password",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
