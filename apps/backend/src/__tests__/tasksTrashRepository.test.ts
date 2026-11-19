import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../lib/httpErrors.js";

const mocks = vi.hoisted(() => {
  const where = vi.fn();
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    where,
    from,
    select,
  };
});

function mockQueryResult(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), {
    limit: vi.fn().mockResolvedValue(rows),
  });
}

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, fn: (tx: { select: typeof mocks.select }) => Promise<unknown>) =>
    fn({ select: mocks.select }),
}));

vi.mock("../db/repositories/facultyAssignmentValidation.js", () => ({
  lockFacultyHierarchy: vi.fn(),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn(),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
}));

import { deleteTask } from "../db/repositories/tasksTrashRepository.js";

describe("tasksTrashRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when task row does not exist", async () => {
    mocks.where.mockReturnValueOnce(mockQueryResult([]));

    const result = await deleteTask("test-tenant", "task-missing");
    expect(result).toBe("not_found");
  });

  it("returns already_deleted when task row is already soft-deleted", async () => {
    mocks.where.mockReturnValueOnce(mockQueryResult([{ deletedAt: new Date() }]));

    const result = await deleteTask("test-tenant", "task-deleted");
    expect(result).toBe("already_deleted");
  });

  it("throws ForbiddenError if actor cannot delete and is not creator or assignee", async () => {
    mocks.where
      .mockReturnValueOnce(mockQueryResult([{ createdByUserId: "other-user", deletedAt: null }]))
      .mockReturnValueOnce(mockQueryResult([]));

    await expect(deleteTask("test-tenant", "task-1", "my-user", false)).rejects.toThrow(
      ForbiddenError,
    );
  });
});
