import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLATFORM_SETTINGS } from "@mms/contracts";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

const { mockSuperUser, mockAllGrantsAdmin } = vi.hoisted(() => {
  const all = { workspaces: true, onboard: true, settings: true, admins: true, system: true };
  const base = {
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    permissions: all,
  };
  return {
    mockSuperUser: {
      ...base,
      id: "p-super",
      email: "admin@platform.com",
      name: "Super Admin",
      role: "super_user" as const,
    },
    mockAllGrantsAdmin: {
      ...base,
      id: "p-admin-all",
      email: "all@platform.com",
      name: "All Grants",
      role: "admin" as const,
    },
  };
});

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mms/mod-platform/backend/platform/repository/db/platformUserRepository", () => ({
  findPlatformUserRowById: vi
    .fn()
    .mockImplementation(async (id: string) =>
      id === mockSuperUser.id
        ? mockSuperUser
        : id === mockAllGrantsAdmin.id
          ? mockAllGrantsAdmin
          : null,
    ),
  findPlatformUserRowByEmail: vi.fn().mockResolvedValue(null),
  listPlatformUsers: vi.fn().mockResolvedValue([mockSuperUser, mockAllGrantsAdmin]),
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

vi.mock("@mms/mod-platform/backend/platform/services/platformModuleService", () => ({
  getPlatformModuleCatalog: vi.fn().mockReturnValue([
    {
      id: "students",
      label: "Students",
      description: "Students",
      icon: "GraduationCap",
      category: "academic",
      required: true,
      defaultEnabled: true,
      platformEnabled: true,
    },
    {
      id: "finance",
      label: "Finance",
      description: "Finance",
      icon: "Wallet",
      category: "finance",
      required: false,
      defaultEnabled: false,
      platformEnabled: false,
    },
  ]),
  updatePlatformModules: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_SETTINGS),
}));

vi.mock("@mms/mod-platform/backend/platform/services/platformLlmService", () => ({
  updatePlatformLlm: vi.fn().mockResolvedValue(DEFAULT_PLATFORM_SETTINGS),
  testPlatformLlm: vi.fn().mockResolvedValue({
    success: true,
    response: "OK",
    metrics: { latencyMs: 12, characterCount: 2, wordCount: 1 },
  }),
  listPlatformLlmModels: vi.fn().mockResolvedValue(["gpt-4o-mini", "gpt-4o"]),
}));

import { insertPlatformActivityLog } from "@mms/mod-platform/backend/platform/repository/db/platformActivityLogsRepository";
import { updatePlatformModules } from "@mms/mod-platform/backend/platform/services/platformModuleService";
import { updatePlatformLlm } from "@mms/mod-platform/backend/platform/services/platformLlmService";

const mockAudit = vi.mocked(insertPlatformActivityLog);
const mockUpdateModules = vi.mocked(updatePlatformModules);
const mockUpdateLlm = vi.mocked(updatePlatformLlm);

describe("platform modules + LLM routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function token(user: typeof mockSuperUser | typeof mockAllGrantsAdmin): string {
    return app.jwt.sign({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      sessionVersion: user.sessionVersion,
      tokenType: "platform_access",
    });
  }

  it("returns the module catalog to a settings admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/modules/catalog",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token(mockAllGrantsAdmin) },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).modules).toHaveLength(2);
  });

  it("updates modules for the super-user and audits it", async () => {
    mockAudit.mockClear();
    mockUpdateModules.mockClear();
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/modules",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token(mockSuperUser) },
      payload: {
        defaultEnabledModules: { students: true, finance: false },
        disabledModules: ["finance"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockUpdateModules).toHaveBeenCalledWith(
      expect.objectContaining({ disabledModules: ["finance"] }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update_platform_modules" }),
    );
  });

  it("rejects module updates from a non-super admin holding every grant", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/modules",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token(mockAllGrantsAdmin) },
      payload: { defaultEnabledModules: {}, disabledModules: [] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects unknown module ids", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/modules",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token(mockSuperUser) },
      payload: { defaultEnabledModules: {}, disabledModules: ["not-a-module"] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("updates the platform LLM config, tests it, and lists models", async () => {
    mockUpdateLlm.mockClear();
    const auth = {
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token(mockSuperUser) },
    };

    const update = await app.inject({
      method: "PUT",
      url: "/api/platform/llm",
      ...auth,
      payload: { llmProvider: "openai", llmApiKey: "****abcd" },
    });
    expect(update.statusCode).toBe(200);
    expect(mockUpdateLlm).toHaveBeenCalledWith(expect.objectContaining({ llmProvider: "openai" }));

    const test = await app.inject({
      method: "POST",
      url: "/api/platform/llm/test",
      ...auth,
      payload: { prompt: "ping" },
    });
    expect(test.statusCode).toBe(200);
    expect(JSON.parse(test.body)).toMatchObject({ success: true, response: "OK" });

    const models = await app.inject({
      method: "POST",
      url: "/api/platform/llm/models",
      ...auth,
      payload: { provider: "openai" },
    });
    expect(models.statusCode).toBe(200);
    expect(JSON.parse(models.body).models).toEqual(["gpt-4o-mini", "gpt-4o"]);
  });

  it("rejects LLM updates from a non-super admin", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/platform/llm",
      headers: { origin: "http://localhost" },
      cookies: { mms_platform_access: token(mockAllGrantsAdmin) },
      payload: { llmProvider: "openai" },
    });
    expect(res.statusCode).toBe(403);
  });
});
