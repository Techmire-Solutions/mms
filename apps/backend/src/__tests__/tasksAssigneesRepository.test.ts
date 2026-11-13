/**
 * @file tasksAssigneesRepository.test.ts
 * @description Unit coverage for assignee reads and the diff-aware audit trail
 * written by `syncTaskAssignees`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordModernAuditEvent: vi.fn(),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.recordModernAuditEvent,
}));

import {
  fetchAssigneesByTaskIds,
  syncTaskAssignees,
} from "../db/repositories/tasksAssigneesRepository.js";

function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.leftJoin = () => chain;
  chain.where = async () => rows;
  return chain;
}

function createTx(previousRows: Array<{ userId: string }> = []) {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const updateWhere = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const select = vi.fn(() => selectChain(previousRows));
  const tx = { select, update, insert };
  return { tx, select, update, set, updateWhere, insert, values };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordModernAuditEvent.mockResolvedValue(undefined);
});

describe("fetchAssigneesByTaskIds", () => {
  it("short-circuits an empty id list without querying", async () => {
    const { tx, select } = createTx();

    await expect(fetchAssigneesByTaskIds(tx as never, "demo", [])).resolves.toEqual(new Map());
    expect(select).not.toHaveBeenCalled();
  });

  it("maps rows into per-task assignee records", async () => {
    const assignedAt = new Date("2026-01-02T03:04:05.000Z");
    const rows = [
      {
        id: "assignee-1",
        taskId: "task-1",
        facultyId: "fac-1",
        facultyAssignmentId: null,
        userId: "user-1",
        assignedAt,
        contactFirstName: "Ayesha",
        contactLastName: "Khan",
        userEmail: "ayesha@example.com",
      },
      {
        id: "assignee-2",
        taskId: "task-1",
        facultyId: "fac-2",
        facultyAssignmentId: "fa-2",
        userId: "user-2",
        assignedAt: null,
        contactFirstName: null,
        contactLastName: null,
        userEmail: null,
      },
      {
        id: "assignee-3",
        taskId: "task-2",
        facultyId: "fac-3",
        facultyAssignmentId: null,
        userId: "user-3",
        assignedAt: null,
        contactFirstName: "Bilal",
        contactLastName: null,
        userEmail: "bilal@example.com",
      },
    ];
    const { tx, select } = createTx();

    const selectWithJoins = vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.leftJoin = () => chain;
      chain.where = async () => rows;
      return chain;
    });
    (tx as unknown as { select: typeof selectWithJoins }).select = selectWithJoins;

    const result = await fetchAssigneesByTaskIds(tx as never, "demo", ["task-1", "task-2"]);

    expect(select).not.toHaveBeenCalled();
    expect(result.get("task-1")).toEqual([
      {
        id: "assignee-1",
        taskId: "task-1",
        facultyId: "fac-1",
        facultyAssignmentId: null,
        userId: "user-1",
        facultyName: "Ayesha Khan",
        userEmail: "ayesha@example.com",
        assignedAt: "2026-01-02T03:04:05.000Z",
      },
      {
        id: "assignee-2",
        taskId: "task-1",
        facultyId: "fac-2",
        facultyAssignmentId: "fa-2",
        userId: "user-2",
        facultyName: undefined,
        userEmail: undefined,
        assignedAt: undefined,
      },
    ]);
    expect(result.get("task-2")).toEqual([
      {
        id: "assignee-3",
        taskId: "task-2",
        facultyId: "fac-3",
        facultyAssignmentId: null,
        userId: "user-3",
        facultyName: "Bilal",
        userEmail: "bilal@example.com",
        assignedAt: undefined,
      },
    ]);
  });
});

describe("syncTaskAssignees", () => {
  it("soft-deletes, re-inserts, and audits a changed assignment set", async () => {
    const { tx, set, updateWhere, insert, values } = createTx([{ userId: "user-1" }]);

    await syncTaskAssignees(
      tx as never,
      "demo",
      "task-1",
      [{ facultyId: "fac-2", facultyAssignmentId: "fa-2", userId: "user-2" }],
      "actor-1",
    );

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ deletedBy: "actor-1" }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        workspaceSubdomain: "demo",
        taskId: "task-1",
        facultyId: "fac-2",
        facultyAssignmentId: "fa-2",
        userId: "user-2",
        assignedByUserId: "actor-1",
      }),
    ]);
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "task_assignees",
        recordId: "task-1",
        actionType: "UPDATE",
        realUserId: "actor-1",
        oldState: { assignees: ["user-1"] },
        newState: { assignees: ["user-2"] },
      }),
    );
  });

  it("does not write audit noise when the assignment set is unchanged", async () => {
    const { tx, insert } = createTx([{ userId: "user-1" }, { userId: "user-2" }]);

    await syncTaskAssignees(
      tx as never,
      "demo",
      "task-1",
      [
        { facultyId: "fac-1", userId: "user-1" },
        { facultyId: "fac-2", userId: "user-2" },
      ],
      "actor-1",
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(mocks.recordModernAuditEvent).not.toHaveBeenCalled();
  });

  it("clears assignments without inserting rows and still audits the removal", async () => {
    const { tx, insert, values } = createTx([{ userId: "user-1" }]);

    await syncTaskAssignees(tx as never, "demo", "task-1", [], undefined);

    expect(insert).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
    expect(mocks.recordModernAuditEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        oldState: { assignees: ["user-1"] },
        newState: { assignees: [] },
        realUserId: undefined,
      }),
    );
  });
});
