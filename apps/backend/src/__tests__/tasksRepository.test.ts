import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const offset = vi.fn().mockResolvedValue([]);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() =>
    Object.assign(Promise.resolve([{ count: 0 }]), {
      orderBy,
      limit: vi.fn().mockResolvedValue([]),
    }),
  );
  const from = vi.fn(() => ({
    where,
  }));
  const select = vi.fn(() => ({ from }));
  return {
    where,
    from,
    select,
  };
});

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenantRead: (
    _tenant: string,
    fn: (tx: { select: typeof mocks.select }) => Promise<unknown>,
  ) => fn({ select: mocks.select }),
}));

vi.mock("../db/repositories/tasksAssigneesRepository.js", () => ({
  fetchAssigneesByTaskIds: vi.fn().mockResolvedValue(new Map()),
}));

import type { TasksRepository } from "../tasks/repository/tasksRepository.js";
import { tasksRepositoryAdapter } from "../tasks/repository/tasksRepositoryAdapter.js";
import { findTaskById, listTasks } from "../db/repositories/tasksRepository.js";

describe("tasksRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies that tasksRepositoryAdapter conforms to TasksRepository interface", () => {
    const repo: TasksRepository = tasksRepositoryAdapter;
    expect(repo).toBeDefined();
    expect(typeof repo.createTask).toBe("function");
    expect(typeof repo.updateTask).toBe("function");
    expect(typeof repo.findTaskById).toBe("function");
    expect(typeof repo.getTaskMetrics).toBe("function");
  });

  it("findTaskById returns null when task does not exist", async () => {
    const task = await findTaskById("test-tenant", "task-missing");
    expect(task).toBeNull();
  });

  it("listTasks returns empty list when no matches", async () => {
    const result = await listTasks("test-tenant", {
      limit: 10,
      offset: 0,
      includeDeleted: false,
      overdue: false,
    });
    expect(result.tasks).toEqual([]);
    expect(result.total).toBe(0);
  });
});
