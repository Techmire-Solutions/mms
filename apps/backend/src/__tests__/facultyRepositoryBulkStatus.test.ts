import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkUpdateFacultyStatusSql } from "../db/repositories/facultyRepositoryList.js";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

vi.mock("../db/repositories/facultyRepository.js", () => ({
  facultyRowToRecord: (row: unknown) => row,
}));

describe("bulkUpdateFacultyStatusSql", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates matching employment status rows and returns row count", async () => {
    const selectWhere = vi
      .fn()
      .mockResolvedValue([{ employmentId: "emp-1" }, { employmentId: "emp-2" }]);
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    const select = vi.fn(() => ({ from: selectFrom }));
    const returning = vi.fn().mockResolvedValue([{ id: "emp-1" }, { id: "emp-2" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    mockWithTenantTransaction.mockImplementation(
      async (
        _tenant: unknown,
        fn: (tx: { update: typeof update; select: typeof select }) => Promise<unknown>,
      ) => fn({ update, select }),
    );
    const succeeded = await bulkUpdateFacultyStatusSql("Demo", ["t-1", "t-2", "t-1"], "inactive");

    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
    // Contract: employment status only (no faculty.status mirror).
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "inactive",
        updatedAt: expect.any(Date),
      }),
    );
    expect(succeeded).toBe(2);
  });

  it("returns 0 when ids are empty", async () => {
    const succeeded = await bulkUpdateFacultyStatusSql("demo", ["  ", ""], "active");
    expect(succeeded).toBe(0);
    expect(mockWithTenantTransaction).not.toHaveBeenCalled();
  });
});
