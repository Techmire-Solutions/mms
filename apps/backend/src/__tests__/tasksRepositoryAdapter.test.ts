import { beforeEach, describe, expect, it, vi } from "vitest";

const tasksRepoMock = vi.hoisted(() => ({
  listTasks: vi.fn(),
  findTaskById: vi.fn(),
  getTaskMetrics: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
}));

const tasksBulkRepoMock = vi.hoisted(() => ({
  bulkRestoreTasksBatch: vi.fn(),
  bulkDeleteTasksBatch: vi.fn(),
  bulkUpdateTaskStatusBatch: vi.fn(),
}));

vi.mock("../db/repositories/tasksRepository.js", () => tasksRepoMock);
vi.mock("../db/repositories/tasksBulkRepository.js", () => tasksBulkRepoMock);

import { tasksRepositoryAdapter } from "../tasks/repository/tasksRepositoryAdapter.js";

describe("tasksRepositoryAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes all required CRUD and bulk operations", () => {
    expect(typeof tasksRepositoryAdapter.listTasks).toBe("function");
    expect(typeof tasksRepositoryAdapter.findTaskById).toBe("function");
    expect(typeof tasksRepositoryAdapter.getTaskMetrics).toBe("function");
    expect(typeof tasksRepositoryAdapter.createTask).toBe("function");
    expect(typeof tasksRepositoryAdapter.updateTask).toBe("function");
    expect(typeof tasksRepositoryAdapter.updateTaskStatus).toBe("function");
    expect(typeof tasksRepositoryAdapter.deleteTask).toBe("function");
    expect(typeof tasksRepositoryAdapter.restoreTask).toBe("function");
    expect(typeof tasksRepositoryAdapter.bulkRestoreTasks).toBe("function");
    expect(typeof tasksRepositoryAdapter.bulkDeleteTasks).toBe("function");
    expect(typeof tasksRepositoryAdapter.bulkUpdateTaskStatus).toBe("function");
  });

  it("forwards createTask and updateTask to tasksRepository", async () => {
    tasksRepoMock.createTask.mockResolvedValue({ id: "task-1" });
    tasksRepoMock.updateTask.mockResolvedValue({ id: "task-1" });

    const created = await tasksRepositoryAdapter.createTask(
      "demo",
      { title: "Task 1", priority: "medium", status: "todo", assignees: [] },
      [],
      "user-1",
    );
    expect(tasksRepoMock.createTask).toHaveBeenCalledWith(
      "demo",
      { title: "Task 1", priority: "medium", status: "todo", assignees: [] },
      [],
      "user-1",
    );
    expect(created).toEqual({ id: "task-1" });

    const updated = await tasksRepositoryAdapter.updateTask(
      "demo",
      "task-1",
      { title: "Task 1 Updated" },
      [],
      "user-1",
    );
    expect(tasksRepoMock.updateTask).toHaveBeenCalledWith(
      "demo",
      "task-1",
      { title: "Task 1 Updated" },
      [],
      "user-1",
    );
    expect(updated).toEqual({ id: "task-1" });
  });
});
