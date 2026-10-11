import { beforeEach, describe, expect, it, vi } from "vitest";
import { findStudentRegistrationConflictSql } from "../db/repositories/studentRepositoryWidgets.js";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  // Read paths now go through withTenantRead (read replica + read-only tx).
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

describe("findStudentRegistrationConflictSql GR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns grNumber when another active student shares normalized GR", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "s-other" }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    const reason = await findStudentRegistrationConflictSql("demo", {
      grNumber: "  GR-9  ",
      excludeId: "s-self",
    });
    expect(reason).toBe("grNumber");
    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(select).toHaveBeenCalled();
  });

  it("returns email when another active student shares contact email", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "s-other" }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    const reason = await findStudentRegistrationConflictSql("demo", {
      email: "student@example.com",
      excludeId: "s-self",
    });
    expect(reason).toBe("email");
    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(select).toHaveBeenCalled();
  });

  it("returns null when no duplicate conflict exists", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    const reason = await findStudentRegistrationConflictSql("demo", {
      email: "unique@example.com",
      contactId: "c-unique",
      grNumber: "GR-100",
    });
    expect(reason).toBeNull();
    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
  });

  it("returns nameDob when another active student shares contact name and dob", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "s-other" }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (tx: { select: typeof select }) => Promise<unknown>) =>
        fn({ select }),
    );

    const reason = await findStudentRegistrationConflictSql("demo", {
      name: "Ali Ahmed",
      dob: "2012-05-15",
      excludeId: "s-self",
    });
    expect(reason).toBe("nameDob");
    expect(mockWithTenantTransaction).toHaveBeenCalledWith("demo", expect.any(Function));
    expect(select).toHaveBeenCalled();
  });
});
