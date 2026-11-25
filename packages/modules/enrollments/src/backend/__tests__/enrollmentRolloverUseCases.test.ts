vi.mock("@mms/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/client")>()),
  runInTransaction: async (cb: any) =>
    cb({
      select: () => ({ from: () => ({ where: () => ({ for: async () => [] }) }) }),
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [{ id: "enr-1" }] }) }),
      }),
      insert: () => ({ values: async () => [] }),
      delete: () => ({ where: async () => [] }),
    }),
  withTenant: async (_t: string, cb: any) =>
    cb({
      select: () => ({ from: () => ({ where: () => ({ for: async () => [] }) }) }),
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [{ id: "enr-1" }] }) }),
      }),
      insert: () => ({ values: async () => [] }),
      delete: () => ({ where: async () => [] }),
    }),
}));
vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),
  withTenant: async (_t: string, cb: any) =>
    cb({
      select: () => ({ from: () => ({ where: () => ({ for: async () => [] }) }) }),
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [{ id: "enr-1" }] }) }),
      }),
      insert: () => ({ values: async () => [] }),
      delete: () => ({ where: async () => [] }),
    }),
  withTenantRead: async (_t: string, cb: any) =>
    cb({
      select: () => ({ from: () => ({ where: () => ({ for: async () => [] }) }) }),
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [{ id: "enr-1" }] }) }),
      }),
      insert: () => ({ values: async () => [] }),
      delete: () => ({ where: async () => [] }),
    }),
}));

import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  bulkApplyEnrollmentWithdrawal: vi.fn(),
}));

vi.mock("../repository/enrollmentOperationsRepositoryAdapter.js", () => ({
  enrollmentOperationsRepository: {
    bulkApplyEnrollmentWithdrawal: hooks.bulkApplyEnrollmentWithdrawal,
  },
}));

import { bulkCloseRolloverSourceEnrollments } from "../use-cases/enrollmentRolloverUseCases.js";

describe("bulkCloseRolloverSourceEnrollments", () => {
  it("maps close inputs to a single bulk withdrawal", async () => {
    // Arrange
    hooks.bulkApplyEnrollmentWithdrawal.mockResolvedValue(undefined);

    // Act
    await bulkCloseRolloverSourceEnrollments(
      "demo",
      [
        { enrollmentId: "e1", studentId: "s1", status: "promoted", lastDay: "2026-12-31" },
        { enrollmentId: "e2", studentId: "s2", status: "retained", lastDay: "2026-12-31" },
      ],
      { userId: "u-1", label: "Session rollover" },
    );

    // Assert
    expect(hooks.bulkApplyEnrollmentWithdrawal).toHaveBeenCalledTimes(1);
    expect(hooks.bulkApplyEnrollmentWithdrawal).toHaveBeenCalledWith(
      "demo",
      [
        { enrollmentId: "e1", studentId: "s1", status: "promoted", effectiveOn: "2026-12-31" },
        { enrollmentId: "e2", studentId: "s2", status: "retained", effectiveOn: "2026-12-31" },
      ],
      "Year-end rollover",
      { userId: "u-1", label: "Session rollover" },
    );
  });
});
