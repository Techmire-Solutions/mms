import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return {
    returning,
    where,
    set,
    update,
    invalidate: vi.fn(),
    enable: vi.fn(),
    cascadeDelete: vi.fn(),
    cascadeRestore: vi.fn(),
  };
});

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (_tenant: string, fn: (tx: { update: typeof mocks.update }) => Promise<unknown>) =>
    fn({ update: mocks.update }),
}));

vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: mocks.invalidate,
}));

vi.mock("../lib/softDeleteHelpers.js", () => ({
  enableIncludeDeleted: mocks.enable,
  withIncludeDeletedScope: (_tx: unknown, work: () => Promise<unknown>) => work(),
}));

vi.mock("../db/repositories/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: mocks.cascadeDelete,
  restoreCascadedEnrollmentsForStudents: mocks.cascadeRestore,
}));

import {
  bulkRestoreStudentsSql,
  bulkSoftDeleteStudentsSql,
} from "../db/repositories/studentRepositorySoftDelete.js";

describe("bulkRestoreStudentsSql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enable.mockResolvedValue(undefined);
    mocks.invalidate.mockResolvedValue(undefined);
    mocks.cascadeDelete.mockResolvedValue(undefined);
    mocks.cascadeRestore.mockResolvedValue(undefined);
    mocks.returning.mockResolvedValue([{ id: "a" }]);
  });

  it("uses the caller's batch instant and reports the restored ids", async () => {
    const restoredAt = new Date("2026-08-01T00:00:00.000Z");

    const result = await bulkRestoreStudentsSql("Demo", ["a", "a", "b"], "u-1", restoredAt);

    expect(result).toEqual({ succeeded: 1, failed: 1, restoredIds: ["a"] });
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ restoredAt, restoredBy: "u-1" }),
    );
    expect(mocks.invalidate).toHaveBeenCalledWith({ tenantId: "demo", domain: "students" });
  });

  it("restores the cascade-archived enrollments inside the same parent write", async () => {
    const restoredAt = new Date("2026-08-01T00:00:00.000Z");

    await bulkRestoreStudentsSql("Demo", ["a"], "u-1", restoredAt);

    expect(mocks.cascadeRestore).toHaveBeenCalledWith(
      expect.anything(),
      "demo",
      ["a"],
      "u-1",
      restoredAt,
    );
  });

  it("soft-deletes in one statement and reports the count", async () => {
    mocks.returning.mockResolvedValue([{ id: "a" }, { id: "b" }]);

    const result = await bulkSoftDeleteStudentsSql("Demo", ["a", "a", "b"], "u-1", "cleanup");

    expect(result).toEqual({ succeeded: 2, failed: 0 });
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedBy: "u-1", deletionReason: "cleanup" }),
    );
  });

  it("archives the dependent enrollments with the student", async () => {
    mocks.returning.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const before = Date.now();

    await bulkSoftDeleteStudentsSql("Demo", ["a", "b"], "u-1", "cleanup");

    expect(mocks.cascadeDelete).toHaveBeenCalledTimes(1);
    const [tx, tenant, ids, deletedBy, reason, deletedAt] = mocks.cascadeDelete.mock.calls[0]!;
    expect(tx).toEqual({ update: mocks.update });
    expect(tenant).toBe("demo");
    expect(ids).toEqual(["a", "b"]);
    expect(deletedBy).toBe("u-1");
    expect(reason).toBe("cleanup");
    expect(deletedAt).toBeInstanceOf(Date);
    expect((deletedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("returns an empty result without touching the database", async () => {
    await expect(bulkRestoreStudentsSql("demo", [])).resolves.toEqual({
      succeeded: 0,
      failed: 0,
      restoredIds: [],
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
