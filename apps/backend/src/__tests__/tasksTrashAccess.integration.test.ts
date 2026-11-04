/**
 * Fastify inject coverage for the Tasks trash gate and archive error taxonomy.
 */
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tasksRoutes from "../routes/tenant/tasksRoutes.js";
import { ConflictError, ValidationError } from "../lib/httpErrors.js";

const {
  canPerformTaskAction,
  mutateTask,
  listTasks,
  findTaskById,
  updateTaskStatus,
  bulkUpdateTaskStatus,
  deleteTask,
  restoreTask,
} = vi.hoisted(() => ({
  canPerformTaskAction: vi.fn(),
  mutateTask: vi.fn(),
  listTasks: vi.fn(),
  findTaskById: vi.fn(),
  updateTaskStatus: vi.fn(),
  bulkUpdateTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
}));

vi.mock("../middleware/authenticate.js", () => ({ authenticateTenant: async () => {} }));
vi.mock("../middleware/requireTenantModule.js", () => ({ registerModuleAccess: vi.fn() }));
vi.mock("../services/taskPermissionService.js", () => ({
  canPerformTaskAction: (...args: unknown[]) => canPerformTaskAction(...args),
}));
vi.mock("../services/taskMutationService.js", () => ({
  mutateTask: (...args: unknown[]) => mutateTask(...args),
  TaskDelegationError: class TaskDelegationError extends Error {},
}));
vi.mock("../services/taskEligibleAssigneesService.js", () => ({
  getEligibleTaskAssignees: vi.fn(),
}));
vi.mock("../services/taskSettingsService.js", () => ({
  getTenantTaskSettings: vi.fn(),
  updateTenantTaskSettings: vi.fn(),
}));
vi.mock("../db/repositories/tasksRepository.js", () => ({
  listTasks: (...args: unknown[]) => listTasks(...args),
  findTaskById: (...args: unknown[]) => findTaskById(...args),
  getTaskMetrics: vi.fn(),
  updateTaskStatus: (...args: unknown[]) => updateTaskStatus(...args),
  deleteTask: (...args: unknown[]) => deleteTask(...args),
  restoreTask: (...args: unknown[]) => restoreTask(...args),
  bulkRestoreTasks: vi.fn(),
  bulkDeleteTasks: vi.fn(),
}));
vi.mock("../db/repositories/tasksTrashRepository.js", () => ({}));
vi.mock("../db/repositories/tasksBulkRepository.js", () => ({
  bulkUpdateTaskStatusBatch: (...args: unknown[]) => bulkUpdateTaskStatus(...args),
  bulkDeleteTasksBatch: vi.fn(),
  bulkRestoreTasksBatch: vi.fn(),
}));
vi.mock("../routes/tenant/tasksSoftDeleteRoutes.js", () => ({
  registerTasksSoftDeleteRoutes: vi.fn(),
}));
vi.mock("../routes/tenant/tasksExportRoutes.js", () => ({ tasksExportRoutes: async () => {} }));

async function buildTasksApp() {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.user = {
      id: "u-actor",
      name: "Actor",
      email: "actor@example.test",
      role: "teacher",
      workspaceSubdomain: "demo",
    };
    request.tenant = { id: "demo" };
  });
  await app.register(tasksRoutes);
  return app;
}

describe("Tasks trash access (inject)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTasks.mockResolvedValue({ tasks: [], total: 0 });
  });

  it("denies includeDeleted list to a tasks.read-only caller", async () => {
    canPerformTaskAction.mockImplementation(
      async (_req: unknown, permission: string) => permission === "tasks.read",
    );

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks?includeDeleted=true",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(403);
      expect(listTasks).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("allows includeDeleted list to a caller holding tasks.delete", async () => {
    canPerformTaskAction.mockResolvedValue(true);

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks?includeDeleted=true",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(200);
      expect(listTasks).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({ includeDeleted: true }),
      );
    } finally {
      await app.close();
    }
  });

  it("keeps the active list readable to a tasks.read-only caller", async () => {
    canPerformTaskAction.mockImplementation(
      async (_req: unknown, permission: string) => permission === "tasks.read",
    );

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/tasks",
        headers: { host: "demo.localhost" },
      });
      expect(response.statusCode).toBe(200);
      expect(listTasks).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({ includeDeleted: false }),
      );
    } finally {
      await app.close();
    }
  });
});

describe("Tasks write error taxonomy (inject)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps an invalid parent task to 400", async () => {
    canPerformTaskAction.mockResolvedValue(true);
    mutateTask.mockRejectedValueOnce(new ValidationError("Invalid parent task"));

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: { host: "demo.localhost" },
        payload: { title: "Child", parentTaskId: "missing" },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        type: "validation_error",
        message: "Invalid parent task",
      });
    } finally {
      await app.close();
    }
  });

  it("maps an archive conflict raised during update to 409", async () => {
    canPerformTaskAction.mockResolvedValue(true);
    mutateTask.mockRejectedValueOnce(new ConflictError("Task has active subtasks"));

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/tasks/task-1",
        headers: { host: "demo.localhost" },
        payload: { title: "Renamed" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ type: "conflict" });
    } finally {
      await app.close();
    }
  });

  it("still surfaces an unexpected failure as 500", async () => {
    canPerformTaskAction.mockResolvedValue(true);
    mutateTask.mockRejectedValueOnce(new Error("connection reset"));

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: { host: "demo.localhost" },
        payload: { title: "Child" },
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({ type: "server_error" });
    } finally {
      await app.close();
    }
  });
});
