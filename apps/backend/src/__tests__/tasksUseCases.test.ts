import { describe, expect, it, vi } from "vitest";
import { createTasksUseCases, tasksUseCases } from "../tasks/use-cases/tasksUseCases.js";
import { tasksRepositoryAdapter } from "../tasks/repository/tasksRepositoryAdapter.js";
import type { TasksRepository } from "../tasks/repository/tasksRepository.js";

describe("tasksUseCases and tasksRepositoryAdapter", () => {
  it("exposes all required CRUD and bulk operations on tasksRepositoryAdapter", () => {
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

  it("delegates createTask and updateTask through the injected TasksRepository", async () => {
    const mockCreateTask = vi.fn().mockResolvedValue({ id: "task-1", title: "New Task" });
    const mockUpdateTask = vi.fn().mockResolvedValue({ id: "task-1", title: "Updated Task" });
    const mockGetTaskMetrics = vi.fn().mockResolvedValue({ total: 10, todo: 4 });

    const fakeRepo: TasksRepository = {
      listTasks: vi.fn(),
      findTaskById: vi.fn(),
      getTaskMetrics: mockGetTaskMetrics as unknown as TasksRepository["getTaskMetrics"],
      createTask: mockCreateTask as unknown as TasksRepository["createTask"],
      updateTask: mockUpdateTask as unknown as TasksRepository["updateTask"],
      updateTaskStatus: vi.fn(),
      deleteTask: vi.fn(),
      restoreTask: vi.fn(),
      bulkRestoreTasks: vi.fn(),
      bulkDeleteTasks: vi.fn(),
      bulkUpdateTaskStatus: vi.fn(),
    };

    const useCases = createTasksUseCases(fakeRepo);

    const created = await useCases.createTask(
      "demo",
      { title: "New Task", priority: "medium", status: "todo", assignees: [] },
      [],
      "u-1",
    );
    expect(mockCreateTask).toHaveBeenCalledWith(
      "demo",
      { title: "New Task", priority: "medium", status: "todo", assignees: [] },
      [],
      "u-1",
    );
    expect(created).toEqual({ id: "task-1", title: "New Task" });

    const updated = await useCases.updateTask(
      "demo",
      "task-1",
      { title: "Updated Task" },
      [],
      "u-1",
    );
    expect(mockUpdateTask).toHaveBeenCalledWith(
      "demo",
      "task-1",
      { title: "Updated Task" },
      [],
      "u-1",
    );
    expect(updated).toEqual({ id: "task-1", title: "Updated Task" });

    const metrics = await useCases.getTaskMetrics("demo");
    expect(mockGetTaskMetrics).toHaveBeenCalledWith("demo");
    expect(metrics).toEqual({ total: 10, todo: 4 });
  });

  it("singleton tasksUseCases exposes default adapter methods", () => {
    expect(typeof tasksUseCases.createTask).toBe("function");
    expect(typeof tasksUseCases.updateTask).toBe("function");
    expect(typeof tasksUseCases.getTaskMetrics).toBe("function");
  });
});
