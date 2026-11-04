import { describe, expect, it } from "vitest";
import type { TasksRepository } from "../tasks/repository/tasksRepository.js";
import { tasksRepositoryAdapter } from "../tasks/repository/tasksRepositoryAdapter.js";

describe("tasksRepository", () => {
  it("verifies that tasksRepositoryAdapter conforms to TasksRepository interface", () => {
    const repo: TasksRepository = tasksRepositoryAdapter;
    expect(repo).toBeDefined();
    expect(typeof repo.createTask).toBe("function");
    expect(typeof repo.updateTask).toBe("function");
    expect(typeof repo.findTaskById).toBe("function");
    expect(typeof repo.getTaskMetrics).toBe("function");
  });
});
