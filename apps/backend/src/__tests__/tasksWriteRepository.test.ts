/**
 * @file tasksWriteRepository.test.ts
 * @description Unit coverage for the task write repository: insert/update
 * payload shaping, optimistic-concurrency conflicts, status transitions, and
 * the audit snapshots the module relies on.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withTenant: vi.fn(),
  findTaskById: vi.fn(),
  syncTaskAssignees: vi.fn(),
  lockFacultyHierarchy: vi.fn(),
  recordModernAuditEvent: vi.fn(),
}));

vi.mock("../db/tenant-context.js", () => ({ withTenant: mocks.withTenant }));
vi.mock("../db/repositories/tasksRepository.js", () => ({
  findTaskById: mocks.findTaskById,
}));
vi.mock("../db/repositories/tasksAssigneesRepository.js", () => ({
  syncTaskAssignees: mocks.syncTaskAssignees,
}));
vi.mock("../db/repositories/facultyAssignmentValidation.js", () => ({
  lockFacultyHierarchy: mocks.lockFacultyHierarchy,
}));
vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.recordModernAuditEvent,
}));

import { ConflictError, ValidationError } from "../lib/httpErrors.js";
import {
  createTask,
  updateTask,
  updateTaskStatus,
} from "../db/repositories/tasksWriteRepository.js";

const currentTask = {
  id: "task-1",
  workspaceSubdomain: "demo",
  title: "Existing task",
  status: "todo" as const,
  priority: "medium" as const,
  dueAt: "2026-12-01T10:00:00.000Z",
};

function createTx({
  updatedRows = [{ id: "task-1" }] as Array<{ id: string }>,
  parentRows = [] as Array<{ id: string; parent_id: string | null; cycle: boolean }>,
} = {}) {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const returning = vi.fn(async () => updatedRows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const execute = vi.fn(async () => ({ rows: parentRows }));
  const tx = { insert, update, execute };
  return { tx, insert, values, update, set, where, returning, execute };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.withTenant.mockImplementation(
    async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) => callback(createTx().tx),
  );
  mocks.findTaskById.mockResolvedValue(currentTask);
  mocks.syncTaskAssignees.mockResolvedValue(undefined);
  mocks.lockFacultyHierarchy.mockResolvedValue(undefined);
  mocks.recordModernAuditEvent.mockResolvedValue(undefined);
});

describe("createTask", () => {
  it("inserts the task, syncs assignees, and records a full audit snapshot", async () => {
    const tx = createTx();
    mocks.withTenant.mockImplementation(
      async (_tenant: string, callback: (t: unknown) => Promise<unknown>) => callback(tx.tx),
    );
    const created = { id: "generated", title: "New task" };
    mocks.findTaskById.mockResolvedValue(created);

    const result = await createTask(
      "Demo",
      {
        title: "New task",
        description: "Details",
        status: "in_progress",
        priority: "high",
        startDate: "2026-11-20",
        dueAt: "2026-11-25T09:30:00.000Z",
        assignees: [],
      },
      [{ facultyId: "fac-1", userId: "user-1" }],
      "actor-1",
    );

    expect(result).toBe(created);
    expect(mocks.lockFacultyHierarchy).toHaveBeenCalledWith(tx.tx, "demo");
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        title: "New task",
        description: "Details",
        status: "in_progress",
        priority: "high",
        startDate: "2026-11-20",
        dueAt: new Date("2026-11-25T09:30:00.000Z"),
        parentTaskId: null,
        createdByUserId: "actor-1",
        assignedByUserId: "actor-1",
        createdBy: "actor-1",
        updatedBy: "actor-1",
        completedAt: null,
        cancelledAt: null,
      }),
    );
    expect(mocks.syncTaskAssignees).toHaveBeenCalledWith(
      tx.tx,
      "demo",
      expect.any(String),
      [{ facultyId: "fac-1", userId: "user-1" }],
      "actor-1",
    );
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      tx.tx,
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "tasks",
        actionType: "CREATE",
        realUserId: "actor-1",
        newState: {
          title: "New task",
          status: "in_progress",
          priority: "high",
          dueAt: "2026-11-25T09:30:00.000Z",
          recipients: ["user-1"],
        },
      }),
    );
    expect(mocks.findTaskById).toHaveBeenCalledWith("demo", expect.any(String));
  });

  it("records null dueAt and no assigner when there are no recipients", async () => {
    const tx = createTx();
    mocks.withTenant.mockImplementation(
      async (_tenant: string, callback: (t: unknown) => Promise<unknown>) => callback(tx.tx),
    );

    await createTask(
      "demo",
      { title: "No date", status: "todo", priority: "low", assignees: [] },
      [],
      "actor-1",
    );

    expect(tx.values).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: null, assignedByUserId: null, completedAt: null }),
    );
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      tx.tx,
      expect.objectContaining({
        newState: expect.objectContaining({ dueAt: null, recipients: [] }),
      }),
    );
  });

  it("validates a parent chain through the recursive query", async () => {
    const tx = createTx({ parentRows: [{ id: "parent-1", parent_id: null, cycle: false }] });
    mocks.withTenant.mockImplementation(
      async (_tenant: string, callback: (t: unknown) => Promise<unknown>) => callback(tx.tx),
    );

    await createTask(
      "demo",
      {
        title: "Child",
        status: "todo",
        priority: "medium",
        parentTaskId: "parent-1",
        assignees: [],
      },
      [],
      "actor-1",
    );

    expect(tx.execute).toHaveBeenCalledTimes(1);
  });

  it("rejects a parent chain that is missing or cyclic", async () => {
    const tx = createTx({ parentRows: [] });
    mocks.withTenant.mockImplementation(
      async (_tenant: string, callback: (t: unknown) => Promise<unknown>) => callback(tx.tx),
    );

    await expect(
      createTask(
        "demo",
        {
          title: "Child",
          status: "todo",
          priority: "medium",
          parentTaskId: "missing",
          assignees: [],
        },
        [],
        "actor-1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fails loudly when the created task cannot be read back", async () => {
    const tx = createTx();
    mocks.withTenant.mockImplementation(
      async (_tenant: string, callback: (t: unknown) => Promise<unknown>) => callback(tx.tx),
    );
    mocks.findTaskById.mockResolvedValue(null);

    await expect(
      createTask(
        "demo",
        { title: "Ghost", status: "todo", priority: "medium", assignees: [] },
        [],
        "actor-1",
      ),
    ).rejects.toThrow("Task creation verification failed");
  });
});

describe("updateTask", () => {
  function runUpdate(tx: ReturnType<typeof createTx>) {
    mocks.withTenant.mockImplementation(
      async (_tenant: string, callback: (t: unknown) => Promise<unknown>) => callback(tx.tx),
    );
  }

  it("returns null when the task does not exist", async () => {
    const tx = createTx();
    runUpdate(tx);
    mocks.findTaskById.mockResolvedValue(null);

    await expect(
      updateTask("demo", "missing", { title: "x" }, undefined, "actor-1"),
    ).resolves.toBeNull();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("rejects an unparsable x-expected-updated-at header", async () => {
    const tx = createTx();
    runUpdate(tx);

    await expect(
      updateTask("demo", "task-1", { title: "x" }, undefined, "actor-1", "not-a-date"),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a status transition the lifecycle graph forbids", async () => {
    const tx = createTx();
    runUpdate(tx);
    mocks.findTaskById.mockResolvedValue({ ...currentTask, status: "completed" });

    await expect(
      updateTask("demo", "task-1", { status: "todo" }, undefined, "actor-1"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("audits title and due-date changes and syncs recipients", async () => {
    const tx = createTx();
    runUpdate(tx);
    const updated = { ...currentTask, title: "Renamed", dueAt: null };
    mocks.findTaskById.mockResolvedValueOnce(currentTask).mockResolvedValueOnce(updated);

    const result = await updateTask(
      "demo",
      "task-1",
      { title: "Renamed", dueAt: null, status: "in_progress" },
      [{ facultyId: "fac-2", userId: "user-2" }],
      "actor-2",
      "2026-11-13T09:00:00.000Z",
    );

    expect(result).toBe(updated);
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Renamed",
        dueAt: null,
        status: "in_progress",
        completedAt: null,
        cancelledAt: null,
        assignedByUserId: "actor-2",
        updatedBy: "actor-2",
      }),
    );
    expect(mocks.syncTaskAssignees).toHaveBeenCalledWith(
      tx.tx,
      "demo",
      "task-1",
      [{ facultyId: "fac-2", userId: "user-2" }],
      "actor-2",
    );
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      tx.tx,
      expect.objectContaining({
        tableName: "tasks",
        recordId: "task-1",
        actionType: "UPDATE",
        oldState: {
          title: "Existing task",
          status: "todo",
          priority: "medium",
          dueAt: "2026-12-01T10:00:00.000Z",
        },
        newState: {
          title: "Renamed",
          status: "in_progress",
          priority: "medium",
          dueAt: null,
          recipients: ["user-2"],
        },
      }),
    );
  });

  it("maps zero affected rows on a versioned update to a conflict", async () => {
    const tx = createTx({ updatedRows: [] });
    runUpdate(tx);

    await expect(
      updateTask(
        "demo",
        "task-1",
        { title: "x" },
        undefined,
        "actor-1",
        "2026-11-13T09:00:00.000Z",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("keeps the current values in the audit snapshot when fields are omitted", async () => {
    const tx = createTx();
    runUpdate(tx);

    await updateTask("demo", "task-1", { description: "only description" }, undefined, "actor-1");

    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      tx.tx,
      expect.objectContaining({
        newState: {
          title: "Existing task",
          status: "todo",
          priority: "medium",
          dueAt: "2026-12-01T10:00:00.000Z",
        },
      }),
    );
  });

  it("delegates status updates through updateTask", async () => {
    const tx = createTx();
    runUpdate(tx);

    await updateTaskStatus("demo", "task-1", "in_progress", "actor-1");

    expect(tx.set).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
  });
});
