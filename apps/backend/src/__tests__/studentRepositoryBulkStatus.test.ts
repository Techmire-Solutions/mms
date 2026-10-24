import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkUpdateStudentsStatusSql } from "../db/repositories/studentRepositoryList.js";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

vi.mock("./studentRepository.js", () => ({
  studentRowToRecord: (row: unknown) => row,
}));

describe("bulkUpdateStudentsStatusSql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates matching active ids in one transaction and returns row count", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "s-1" }, { id: "s-2" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { update: typeof update }) => Promise<unknown>) =>
        fn({ update }),
    );
    const succeeded = await bulkUpdateStudentsStatusSql("Demo", ["s-1", "s-2", "s-1"], "inactive");

    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive" }));
    expect(succeeded).toBe(2);
  });

  it("returns 0 when ids are empty", async () => {
    const succeeded = await bulkUpdateStudentsStatusSql("demo", ["  ", ""], "active");
    expect(succeeded).toBe(0);
    expect(mockWithTenantTransaction).not.toHaveBeenCalled();
  });
});
