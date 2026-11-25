import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  resetPlatformContactsRepositoryForTesting,
  setPlatformContactsRepositoryForTesting,
  type PlatformContactsRepository,
} from "@mms/mod-contacts/backend/repository";
import { buildApp } from "../app.js";

function createFakePlatformRepository(): PlatformContactsRepository {
  const contact = { id: "c1", name: "Ali", kind: "external" };
  return {
    list: vi.fn().mockResolvedValue([contact]),
    get: vi.fn().mockResolvedValue(contact),
    create: vi.fn().mockResolvedValue(contact),
    update: vi.fn().mockResolvedValue(contact),
    softDelete: vi.fn().mockResolvedValue(true),
    restore: vi.fn().mockResolvedValue(true),
    metrics: vi.fn().mockResolvedValue({
      total: 1,
      byKind: { external: 1 },
      reachableEmail: 0,
      reachablePhone: 0,
    }),
    insertActivityLog: vi.fn().mockResolvedValue(undefined),
  };
}

const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    id: "p-super",
    email: "admin@platform.com",
    name: "Super Admin",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
    role: "super_user" as const,
    permissions: {
      workspaces: true,
      onboard: true,
      settings: true,
      admins: true,
      system: true,
      contacts: true,
      messaging: true,
    },
    sessionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
}));

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/repositories/platformUserRepository.js", () => ({
  findPlatformUserRowById: vi.fn().mockResolvedValue(mockUser),
  findPlatformUserRowByEmail: vi.fn().mockResolvedValue(mockUser),
  listPlatformUsers: vi.fn().mockResolvedValue([mockUser]),
  insertPlatformUser: vi.fn(),
  deletePlatformUserRow: vi.fn(),
}));

vi.mock("../db/repositories/platformActivityLogsRepository.js", () => ({
  insertPlatformActivityLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../platform/use-cases/platformMessagingUseCases.js", () => ({
  platformMessagingUseCases: {
    listMessages: vi.fn().mockResolvedValue([]),
    send: vi.fn().mockResolvedValue({ id: "m1", channel: "email", status: "queued" }),
    listTemplates: vi.fn().mockResolvedValue([]),
    saveTemplate: vi
      .fn()
      .mockResolvedValue({ id: "t1", name: "Welcome", channel: "email", body: "hi" }),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    metrics: vi.fn().mockResolvedValue({ total: 0, byStatus: {}, byChannel: {} }),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    restoreMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("platform contacts + messaging routes", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    setPlatformContactsRepositoryForTesting(createFakePlatformRepository());
  });

  afterEach(() => {
    resetPlatformContactsRepositoryForTesting();
  });

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
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        permissions: mockUser.permissions,
        sessionVersion: mockUser.sessionVersion,
        tokenType: "platform_access",
      }),
    },
  });

  it("lists platform contacts", async () => {
    const res = await app.inject({ method: "GET", url: "/api/platform/contacts", ...auth() });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).contacts).toHaveLength(1);
  });

  it("returns contact metrics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/platform/contacts/metrics",
      ...auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).metrics.total).toBe(1);
  });

  it("restores a soft-deleted platform contact", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/contacts/c1/restore",
      ...auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
  });

  it("creates a platform contact", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/platform/contacts",
      ...auth(),
      payload: { name: "Ali", kind: "external", email: "a@b.co", tags: [] },
    });
    expect(res.statusCode).toBe(201);
  });

  it("lists platform messages and metrics", async () => {
    const list = await app.inject({ method: "GET", url: "/api/platform/messages", ...auth() });
    expect(list.statusCode).toBe(200);
    const metrics = await app.inject({
      method: "GET",
      url: "/api/platform/messages/metrics",
      ...auth(),
    });
    expect(metrics.statusCode).toBe(200);
  });

  it("soft-deletes and restores a platform message", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: "/api/platform/messages/m1",
      ...auth(),
      payload: {},
    });
    expect(del.statusCode).toBe(200);
    const restore = await app.inject({
      method: "POST",
      url: "/api/platform/messages/m1/restore",
      ...auth(),
      payload: {},
    });
    expect(restore.statusCode).toBe(200);
  });

  it("sends a broadcast and manages templates", async () => {
    const send = await app.inject({
      method: "POST",
      url: "/api/platform/messages",
      ...auth(),
      payload: { channel: "email", subject: "Hi", body: "Hello", contactIds: ["c1"] },
    });
    expect(send.statusCode).toBe(201);

    const put = await app.inject({
      method: "PUT",
      url: "/api/platform/messages/templates/t1",
      ...auth(),
      payload: { name: "Welcome", channel: "email", body: "hi" },
    });
    expect(put.statusCode).toBe(200);
  });
});
