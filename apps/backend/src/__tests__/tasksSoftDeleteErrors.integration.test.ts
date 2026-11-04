/**
 * Fastify inject coverage for Tasks archive/restore error taxonomy.
 */
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerTasksSoftDeleteRoutes } from "../routes/tenant/tasksSoftDeleteRoutes.js";
import { ConflictError, ValidationError } from "../lib/httpErrors.js";

const { canPerformTaskAction, deleteTask, restoreTask, bulkDeleteTasks, bulkRestoreTasks } =
  vi.hoisted(() => ({
    canPerformTaskAction: vi.fn(),
    deleteTask: vi.fn(),
    restoreTask: vi.fn(),
    bulkDeleteTasks: vi.fn(),
    bulkRestoreTasks: vi.fn(),
  }));

vi.mock("../services/taskPermissionService.js", () => ({
  canPerformTaskAction: (...args: unknown[]) => canPerformTaskAction(...args),
}));
vi.mock("../tasks/use-cases/tasksUseCases.js", () => ({
  deleteTask: (...args: unknown[]) => deleteTask(...args),
  restoreTask: (...args: unknown[]) => restoreTask(...args),
  bulkDeleteTasks: (...args: unknown[]) => bulkDeleteTasks(...args),
  bulkRestoreTasks: (...args: unknown[]) => bulkRestoreTasks(...args),
}));

async function buildApp() {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.user = {
      id: "u-actor",
      name: "Actor",
      email: "actor@example.test",
      role: "admin",
      workspaceSubdomain: "demo",
    };
    request.tenant = { id: "demo" };
  });
  await app.register(async (instance) => {
    await registerTasksSoftDeleteRoutes(instance);
  });
  return app;
}

describe("Tasks archive/restore error taxonomy (inject)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canPerformTaskAction.mockResolvedValue(true);
  });

  it("archives a task with a 200", async () => {
    deleteTask.mockResolvedValueOnce(true);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/tasks/task-1",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
    } finally {
      await app.close();
    }
  });

  it("maps a subtask conflict to 409", async () => {
    deleteTask.mockRejectedValueOnce(new ConflictError("Task has active subtasks"));

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/tasks/task-1",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ type: "conflict" });
    } finally {
      await app.close();
    }
  });

  it("maps an unexpected archive failure to 500 instead of 409", async () => {
    deleteTask.mockRejectedValueOnce(new Error("connection reset"));

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/tasks/task-1",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({ type: "server_error" });
    } finally {
      await app.close();
    }
  });

  it("maps a missing-parent restore to 409", async () => {
    restoreTask.mockRejectedValueOnce(new ConflictError("Restore the parent task first"));

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/task-1/restore",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ type: "conflict" });
    } finally {
      await app.close();
    }
  });

  it("maps an invalid restore payload to 400", async () => {
    restoreTask.mockRejectedValueOnce(new ValidationError("Task id is invalid"));

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks/task-1/restore",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ type: "validation_error" });
    } finally {
      await app.close();
    }
  });
});
