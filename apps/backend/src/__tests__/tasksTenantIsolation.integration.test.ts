/**
 * @file tasksTenantIsolation.integration.test.ts
 * @description Fastify inject tests verifying multi-tenant isolation, cross-tenant
 * access rejections, and security boundary guarantees for the Tasks module.
 */
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listTasks: vi.fn(),
  mutateTask: vi.fn(),
  deleteTask: vi.fn(),
  checkBatch: vi.fn(),
}));

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
  getPoolMetrics: vi.fn().mockReturnValue({ totalCount: 5, idleCount: 4, waitingCount: 0 }),
}));

vi.mock("../services/authSessionService.js", () => ({
  checkTenantAuthPipelineBatch: (...args: unknown[]) => mocks.checkBatch(...args),
}));

vi.mock("../services/workspaceService.js", () => ({
  getWorkspaceBySubdomain: vi.fn().mockImplementation(async (subdomain: string) => {
    if (subdomain === "campus-a" || subdomain === "campus-b") {
      return { id: 1, subdomain, enabled: true, madrasaName: "Campus Madrasa" };
    }
    return null;
  }),
}));

vi.mock("../services/globalSettingsService.js", () => ({
  loadGlobalSettings: vi.fn().mockResolvedValue({ sessionTimeout: "30" }),
}));

vi.mock("../services/rbacService.js", () => ({
  getTenantRoleMatrix: vi.fn().mockResolvedValue({
    "u-1": { role: "admin", deletedAt: null },
    "u-attacker": { role: "admin", deletedAt: null },
    "super-1": { role: "super_admin", deletedAt: null },
  }),
  userHasTenantRole: vi.fn().mockResolvedValue(true),
}));

vi.mock("../db/repositories/tasksRepository.js", () => ({
  listTasks: (...args: unknown[]) => mocks.listTasks(...args),
  findTaskById: vi.fn(),
  getTaskMetrics: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
  bulkRestoreTasks: vi.fn(),
  bulkDeleteTasks: vi.fn(),
  bulkUpdateTaskStatus: vi.fn(),
}));

vi.mock("../services/taskMutationService.js", () => ({
  mutateTask: (...args: unknown[]) => mocks.mutateTask(...args),
  TaskDelegationError: class TaskDelegationError extends Error {},
}));

vi.mock("../db/repositories/tasksTrashRepository.js", () => ({
  deleteTask: (...args: unknown[]) => mocks.deleteTask(...args),
  restoreTask: vi.fn(),
}));

import fastifyJwt from "@fastify/jwt";
import tasksRoutes from "../routes/tenant/tasksRoutes.js";

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyJwt, {
    secret: "test-secret-at-least-32-chars-long!!",
  });
  await app.register(tasksRoutes);
  return app;
}

describe("Tasks Module Multi-Tenant & Cross-Institution Boundary Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MMS_APP_DOMAIN = "mms.local";
    mocks.checkBatch.mockResolvedValue({
      tenantBlocked: false,
      tokenRevoked: false,
      userSessionRevoked: false,
      globalSettingsCached: null,
      workspaceCached: null,
    });
    mocks.listTasks.mockResolvedValue({ tasks: [], total: 0 });
  });

  it("rejects unauthenticated requests to /api/tasks with 401 Unauthorized", async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: { host: "campus-a.mms.local" },
      });
      expect(res.statusCode).toBe(401);
      expect(mocks.listTasks).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects requests to /api/tasks missing tenant subdomain with 403 Forbidden", async () => {
    const app = await buildApp();
    try {
      const token = app.jwt.sign({
        id: "u-1",
        email: "staff@campus-a.edu",
        workspaceSubdomain: "campus-a",
        role: "admin",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          authorization: `Bearer ${token}`,
          host: "mms.local", // bare domain with no subdomain
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        type: "forbidden",
        message: "This endpoint requires a tenant subdomain",
      });
      expect(mocks.listTasks).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects cross-tenant access when token institution does not match request institution host", async () => {
    const app = await buildApp();
    try {
      // Token issued for 'campus-a', but attacker sends request targeting 'campus-b'
      const token = app.jwt.sign({
        id: "u-attacker",
        email: "attacker@campus-a.edu",
        workspaceSubdomain: "campus-a",
        role: "admin",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          host: "campus-b.mms.local",
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        type: "forbidden",
        message: "Token is not valid for this workspace",
      });
      expect(mocks.listTasks).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects cross-tenant write mutation attempts (POST /api/tasks) with 403 Forbidden", async () => {
    const app = await buildApp();
    try {
      const token = app.jwt.sign({
        id: "u-attacker",
        email: "attacker@campus-a.edu",
        workspaceSubdomain: "campus-a",
        role: "admin",
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: {
          host: "campus-b.mms.local",
          authorization: `Bearer ${token}`,
        },
        payload: {
          title: "Malicious Cross-Tenant Task",
          status: "todo",
          priority: "high",
          assignees: [],
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({
        type: "forbidden",
        message: "Token is not valid for this workspace",
      });
      expect(mocks.mutateTask).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects platform_access superuser tokens on tenant tasks endpoints", async () => {
    const app = await buildApp();
    try {
      const token = app.jwt.sign({
        id: "super-1",
        email: "platform@mms.local",
        workspaceSubdomain: "campus-a",
        tokenType: "platform_access",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          host: "campus-a.mms.local",
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({
        type: "auth_required",
        message: "Platform session cannot access tenant resources",
      });
      expect(mocks.listTasks).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects refresh tokens used as bearer tokens on tasks endpoints", async () => {
    const app = await buildApp();
    try {
      const token = app.jwt.sign({
        id: "u-1",
        email: "staff@campus-a.edu",
        workspaceSubdomain: "campus-a",
        tokenType: "refresh",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          host: "campus-a.mms.local",
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({
        type: "auth_required",
        message: "Refresh token cannot access this resource",
      });
      expect(mocks.listTasks).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("allows authenticated tenant admin to access their own workspace tasks", async () => {
    const app = await buildApp();
    try {
      const token = app.jwt.sign({
        id: "u-1",
        email: "admin@campus-a.edu",
        workspaceSubdomain: "campus-a",
        role: "admin",
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: {
          host: "campus-a.mms.local",
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mocks.listTasks).toHaveBeenCalledWith("campus-a", expect.anything());
    } finally {
      await app.close();
    }
  });
});
