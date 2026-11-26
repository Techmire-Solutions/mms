import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@mms/be-core/http/errors";

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

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenant: (
    _tenant: string,
    fn: (tx: {
      select: typeof mocks.select;
      execute: ReturnType<typeof vi.fn>;
    }) => Promise<unknown>,
  ) => fn({ select: mocks.select, execute: vi.fn().mockResolvedValue([]) }),
}));

vi.mock("@mms/mod-faculty/backend/repository", () => ({
  lockFacultyHierarchy: vi.fn(),
}));

vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: vi.fn(),
}));

vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: vi.fn(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
}));

import { deleteTask } from "../repository/db/tasksTrashRepository.js";

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
