/**
 * Fastify inject coverage for tasks.assign / tasks.assign_anywhere route gates.
 */
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tasksRoutes from "../routes/tenant/tasksRoutes.js";

const {
  canPerformTaskAction,
  mutateTask,
  listTasks,
  findTaskById,
  getTaskMetrics,
  updateTaskStatus,
  getEligibleTaskAssignees,
  getTenantTaskSettings,
  updateTenantTaskSettings,
} = vi.hoisted(() => ({
  canPerformTaskAction: vi.fn(),
  mutateTask: vi.fn(),
  listTasks: vi.fn(),
  findTaskById: vi.fn(),
  getTaskMetrics: vi.fn(),
  updateTaskStatus: vi.fn(),
  getEligibleTaskAssignees: vi.fn(),
  getTenantTaskSettings: vi.fn(),
  updateTenantTaskSettings: vi.fn(),
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
vi.mock("../db/repositories/tasksRepository.js", () => ({
  listTasks: (...args: unknown[]) => listTasks(...args),
  findTaskById: (...args: unknown[]) => findTaskById(...args),
  getTaskMetrics: (...args: unknown[]) => getTaskMetrics(...args),
  updateTaskStatus: (...args: unknown[]) => updateTaskStatus(...args),
}));
vi.mock("../services/taskEligibleAssigneesService.js", () => ({
  getEligibleTaskAssignees: (...args: unknown[]) => getEligibleTaskAssignees(...args),
}));
vi.mock("../services/taskSettingsService.js", () => ({
  getTenantTaskSettings: (...args: unknown[]) => getTenantTaskSettings(...args),
  updateTenantTaskSettings: (...args: unknown[]) => updateTenantTaskSettings(...args),
}));
vi.mock("../routes/tenant/tasksSoftDeleteRoutes.js", () => ({
  registerTasksSoftDeleteRoutes: vi.fn(),
}));

const TASK_BODY = {
  title: "Prepare report",
  status: "todo",
  priority: "medium",
  assignees: [{ facultyId: "fac-1", userId: "u-target" }],
};

async function buildTasksApp(role = "teacher") {
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.user = {
      id: "u-actor",
      name: "Actor",
      email: "actor@example.test",
      role,
      workspaceSubdomain: "demo",
    };
    request.tenant = { id: "demo" };
  });
  await app.register(tasksRoutes);
  return app;
}

describe("Tasks assign route gates (inject)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateTask.mockResolvedValue({
      id: "task-1",
      title: TASK_BODY.title,
      assignees: TASK_BODY.assignees,
    });
  });

  it("denies POST /api/tasks with assignees when tasks.assign is missing", async () => {
    canPerformTaskAction.mockImplementation(async (_req: unknown, permission: string) => {
      if (permission === "tasks.write") return true;
      if (permission === "tasks.assign") return false;
      return false;
    });

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: { host: "demo.localhost" },
        payload: TASK_BODY,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        type: "forbidden",
        message: "Assignment permission required",
      });
      expect(mutateTask).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("allows POST /api/tasks with assignees when tasks.assign is granted", async () => {
    canPerformTaskAction.mockImplementation(async (_req: unknown, permission: string) => {
      if (permission === "tasks.write" || permission === "tasks.assign") return true;
      if (permission === "tasks.assign_anywhere") return false;
      return false;
    });

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: { host: "demo.localhost" },
        payload: TASK_BODY,
      });
      expect(response.statusCode).toBe(201);
      expect(mutateTask).toHaveBeenCalledWith(
        "demo",
        "u-actor",
        false,
        expect.objectContaining({ kind: "create" }),
      );
    } finally {
      await app.close();
    }
  });

  it("passes assign_anywhere=true into mutateTask when capability is granted", async () => {
    canPerformTaskAction.mockImplementation(async (_req: unknown, permission: string) => {
      if (
        permission === "tasks.write" ||
        permission === "tasks.assign" ||
        permission === "tasks.assign_anywhere"
      ) {
        return true;
      }
      return false;
    });

    const app = await buildTasksApp("admin");
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/tasks",
        headers: { host: "demo.localhost" },
        payload: TASK_BODY,
      });
      expect(response.statusCode).toBe(201);
      expect(mutateTask).toHaveBeenCalledWith(
        "demo",
        "u-actor",
        true,
        expect.objectContaining({ kind: "create" }),
      );
    } finally {
      await app.close();
    }
  });

  it("denies PATCH assignees update when tasks.assign is missing", async () => {
    canPerformTaskAction.mockImplementation(async (_req: unknown, permission: string) => {
      if (permission === "tasks.write") return true;
      if (permission === "tasks.assign") return false;
      return false;
    });

    const app = await buildTasksApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/tasks/task-1",
        headers: { host: "demo.localhost" },
        payload: { assignees: TASK_BODY.assignees },
      });
      expect(response.statusCode).toBe(403);
      expect(mutateTask).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
