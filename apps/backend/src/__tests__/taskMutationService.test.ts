/**
 * @file taskMutationService.test.ts
 * @description Unit coverage for mutateTask ownership (M2) and the
 * assignee-removal guard.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(),
  lockFacultyHierarchy: vi.fn(),
  findTaskById: vi.fn(),
  updateTask: vi.fn(),
  createTask: vi.fn(),
  validateTaskDelegation: vi.fn(),
  getTenantTaskSettings: vi.fn(),
  emitTaskNotificationIntents: vi.fn(),
}));

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),
  withTenant: mocks.withTenant,
}));
vi.mock("../db/repositories/facultyAssignmentValidation.js", () => ({
  lockFacultyHierarchy: mocks.lockFacultyHierarchy,
}));
vi.mock("../tasks/use-cases/tasksUseCases.js", () => ({
  findTaskById: (...args: unknown[]) => mocks.findTaskById(...args),
  updateTask: (...args: unknown[]) => mocks.updateTask(...args),
  createTask: (...args: unknown[]) => mocks.createTask(...args),
}));
vi.mock("../services/taskDelegationService.js", () => ({
  validateTaskDelegation: (...args: unknown[]) => mocks.validateTaskDelegation(...args),
}));
vi.mock("../services/taskSettingsService.js", () => ({
  getTenantTaskSettings: (...args: unknown[]) => mocks.getTenantTaskSettings(...args),
}));
vi.mock("../services/taskNotificationService.js", () => ({
  emitTaskNotificationIntents: (...args: unknown[]) => mocks.emitTaskNotificationIntents(...args),
}));

import { mutateTask, TaskDelegationError } from "../services/taskMutationService.js";

const settings = {
  delegationScope: "descendants" as const,
  allowSelfAssignment: true,
  notifyOnAssignment: true,
  notifyOnStatusChange: true,
  notificationChannel: "in_app" as const,
};

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    workspaceSubdomain: "demo",
    title: "Task",
    status: "todo" as const,
    priority: "medium" as const,
    createdById: "owner-1",
    assignees: [{ id: "a-1", taskId: "task-1", facultyId: "f-1", userId: "assignee-1" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withTenant.mockImplementation(
    async (_tenant: string, cb: (tx: unknown) => Promise<unknown>) => cb({}),
  );
  mocks.lockFacultyHierarchy.mockResolvedValue(undefined);
  mocks.getTenantTaskSettings.mockResolvedValue(settings);
  mocks.validateTaskDelegation.mockResolvedValue({ valid: true, resolvedAssignees: [] });
  mocks.emitTaskNotificationIntents.mockResolvedValue(undefined);
});

describe("mutateTask ownership (M2)", () => {
  it("rejects an update by a non-owner, non-assignee caller", async () => {
    mocks.findTaskById.mockResolvedValue(task());
    mocks.updateTask.mockResolvedValue(task({ title: "Changed" }));

    await expect(
      mutateTask("demo", "stranger", false, { kind: "update", id: "task-1", data: { title: "x" } }),
    ).rejects.toBeInstanceOf(TaskDelegationError);
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it("allows the creator to update", async () => {
    mocks.findTaskById.mockResolvedValue(task());
    mocks.updateTask.mockResolvedValue(task({ title: "Changed" }));

    await mutateTask("demo", "owner-1", false, {
      kind: "update",
      id: "task-1",
      data: { title: "x" },
    });
    expect(mocks.updateTask).toHaveBeenCalled();
  });

  it("allows an assignee to update", async () => {
    mocks.findTaskById.mockResolvedValue(task());
    mocks.updateTask.mockResolvedValue(task({ title: "Changed" }));

    await mutateTask("demo", "assignee-1", false, {
      kind: "update",
      id: "task-1",
      data: { title: "x" },
    });
    expect(mocks.updateTask).toHaveBeenCalled();
  });

  it("allows an assign_anywhere holder to update another user's task", async () => {
    mocks.findTaskById.mockResolvedValue(task());
    mocks.updateTask.mockResolvedValue(task({ title: "Changed" }));

    await mutateTask("demo", "stranger", true, {
      kind: "update",
      id: "task-1",
      data: { title: "x" },
    });
    expect(mocks.updateTask).toHaveBeenCalled();
  });

  it("rejects stripping assignees without assign_anywhere", async () => {
    mocks.findTaskById.mockResolvedValue(task());
    mocks.validateTaskDelegation.mockResolvedValue({ valid: true, resolvedAssignees: [] });
    mocks.updateTask.mockResolvedValue(task({ assignees: [] }));

    await expect(
      mutateTask("demo", "owner-1", false, {
        kind: "update",
        id: "task-1",
        data: { assignees: [] },
      }),
    ).rejects.toBeInstanceOf(TaskDelegationError);
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });
});
