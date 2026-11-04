import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const selectWhere = vi.fn<() => unknown>(() => []);
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));
  return {
    returning,
    where,
    set,
    update,
    selectWhere,
    from,
    select,
    audit: vi.fn(),
    outbox: vi.fn(),
  };
});

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (
    _tenant: string,
    fn: (tx: { update: typeof mocks.update; select: typeof mocks.select }) => Promise<unknown>,
  ) => fn({ update: mocks.update, select: mocks.select }),
}));

vi.mock("../db/repositories/facultyAssignmentValidation.js", () => ({
  lockFacultyHierarchy: vi.fn(),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: mocks.audit,
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvents: mocks.outbox,
}));

import {
  bulkDeleteTasksBatch,
  bulkRestoreTasksBatch,
  bulkUpdateTaskStatusBatch,
} from "../db/repositories/tasksBulkRepository.js";

describe("tasks bulk repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.returning.mockResolvedValue([]);
    mocks.selectWhere.mockReturnValue([]);
    mocks.audit.mockResolvedValue(undefined);
    mocks.outbox.mockResolvedValue(undefined);
  });

  it("batch-deletes with one update, one outbox batch and per-row audit", async () => {
    mocks.returning.mockResolvedValue([{ id: "a" }, { id: "b" }]);

    const result = await bulkDeleteTasksBatch("Demo", ["a", "b", "a"], "u-1");

    expect(result).toEqual({ deletedIds: ["a", "b"], skipped: [] });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledTimes(2);
    expect(mocks.outbox).toHaveBeenCalledTimes(1);
    expect(mocks.outbox.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("classifies a skipped delete as has_active_children", async () => {
    mocks.returning.mockResolvedValue([]);
    mocks.selectWhere
      .mockReturnValueOnce([]) // subquery built while composing the UPDATE
      .mockReturnValueOnce([{ id: "b", deletedAt: null }])
      .mockReturnValueOnce([{ parentTaskId: "b" }]);

    const result = await bulkDeleteTasksBatch("demo", ["b"], "u-1");

    expect(result.deletedIds).toEqual([]);
    expect(result.skipped).toEqual([{ id: "b", reason: "has_active_children" }]);
  });

  it("batch-restores with one update and reports archived-parent skips", async () => {
    mocks.returning.mockResolvedValue([{ id: "a" }]);
    mocks.selectWhere
      .mockReturnValueOnce([]) // subquery built while composing the UPDATE
      .mockReturnValueOnce([{ id: "b", parentTaskId: "p-1", deletedAt: new Date() }])
      .mockReturnValueOnce([{ id: "p-1", deletedAt: new Date() }]);

    const result = await bulkRestoreTasksBatch("demo", ["a", "b"], "u-1");

    expect(result.restoredIds).toEqual(["a"]);
    expect(result.skipped).toEqual([{ id: "b", reason: "parent_archived" }]);
    expect(mocks.outbox.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it("updates only legal status transitions and reports every skip reason", async () => {
    mocks.selectWhere.mockReturnValue([
      { id: "a", title: "A", createdById: null, status: "todo" },
      { id: "b", title: "B", createdById: null, status: "cancelled" },
      { id: "c", title: "C", createdById: null, status: "in_progress" },
    ]);
    mocks.returning.mockResolvedValue([{ id: "a" }]);

    const result = await bulkUpdateTaskStatusBatch(
      "demo",
      ["a", "b", "c", "missing"],
      "in_progress",
      "u-1",
    );

    expect(result.updatedIds).toEqual(["a"]);
    expect(result.skipped).toEqual([
      { id: "b", reason: "illegal_transition" },
      { id: "c", reason: "already_in_status" },
      { id: "missing", reason: "not_found" },
    ]);
    expect(result.changes).toEqual([
      {
        id: "a",
        title: "A",
        createdById: null,
        previousStatus: "todo",
        status: "in_progress",
      },
    ]);
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
});
