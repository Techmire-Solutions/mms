import { describe, expect, it, vi } from "vitest";
import { createEnrollmentWriteUseCases } from "../enrollments/use-cases/enrollmentWriteUseCases.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { ConflictError, HttpDomainError, ValidationError } from "../lib/httpErrors.js";

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn((_tenant, cb) => cb({} as any)),
}));

vi.mock("../enrollments/use-cases/enrollmentAudit.js", () => ({
  recordEnrollmentAudit: vi.fn().mockResolvedValue(undefined),
  changedEnrollmentFields: vi.fn().mockReturnValue({ oldState: {}, newState: {} }),
}));

vi.mock("../finance/use-cases/financeInvoiceGenerationUseCases.js", () => ({
  maybeGenerateInvoiceForEnrollment: vi.fn((record) => Promise.resolve(record)),
}));

describe("enrollmentWriteUseCases", () => {
  function setupTest() {
    const repo = {
      findEnrollmentById: vi.fn().mockResolvedValue(null),
      transitionEnrollmentStatusTx: vi.fn().mockResolvedValue(undefined),
      findActiveEnrollmentInSession: vi.fn().mockResolvedValue(null),
    } as any;

    const crud = {
      create: vi.fn((data) => Promise.resolve({ id: "enr-new", ...data })),
      updateById: vi.fn((id, data) => Promise.resolve({ id, ...data })),
      deleteById: vi.fn().mockResolvedValue(true),
      restoreById: vi.fn().mockResolvedValue(true),
      bulkRestoreByIds: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 }),
    } as any;

    const deps = {
      findStudentById: vi.fn().mockResolvedValue({ id: "stu-1", name: "Student 1" }),
      findSessionById: vi.fn().mockResolvedValue({ id: "sess-1", name: "Session 1" }),
      findClassById: vi.fn().mockResolvedValue({ id: "cls-1", name: "Class 1" }),
    };

    const useCases = createEnrollmentWriteUseCases({ repo, crud, deps });
    return { useCases, repo, crud, deps };
  }

  it("throws when tenant context is missing", async () => {
    const { useCases } = setupTest();
    await expect(useCases.createEnrollment({ studentId: "stu-1" } as any)).rejects.toThrow(
      "Tenant context required",
    );
  });

  it("creates an enrollment and logs audit inside tenant transaction", async () => {
    const { useCases, crud } = setupTest();
    const result = await runWithTenant("demo", () =>
      useCases.createEnrollment({
        studentId: "stu-1",
        sessionId: "sess-1",
        classId: "cls-1",
        enrolledDate: "2026-09-01",
      } as any),
    );

    expect(result).toBeDefined();
    expect(crud.create).toHaveBeenCalled();
  });

  it("rejects creating an enrollment in a terminal status", async () => {
    const { useCases } = setupTest();
    await expect(
      runWithTenant("demo", () =>
        useCases.createEnrollment({
          studentId: "stu-1",
          sessionId: "sess-1",
          classId: "cls-1",
          status: "cancelled",
        } as any),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects re-creating an archived enrollment id", async () => {
    const { useCases, repo } = setupTest();
    repo.findEnrollmentById.mockResolvedValueOnce({
      id: "enr-archived",
      deletedAt: new Date().toISOString(),
    });

    await expect(
      runWithTenant("demo", () =>
        useCases.createEnrollment({
          id: "enr-archived",
          studentId: "stu-1",
          sessionId: "sess-1",
          classId: "cls-1",
        } as any),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects invalid manual status transition on update", async () => {
    const { useCases, repo } = setupTest();
    repo.findEnrollmentById.mockResolvedValueOnce({
      id: "enr-1",
      status: "completed",
    });

    await expect(
      runWithTenant("demo", () =>
        useCases.updateEnrollmentById("enr-1", {
          status: "pending",
        }),
      ),
    ).rejects.toBeInstanceOf(HttpDomainError);
  });

  it("rejects restoring an enrollment archived with its session cascade", async () => {
    const { useCases, repo } = setupTest();
    repo.findEnrollmentById.mockResolvedValueOnce({
      id: "enr-1",
      deletedAt: new Date().toISOString(),
      deletedWithCascade: true,
    });

    await expect(
      runWithTenant("demo", () => useCases.restoreEnrollmentById("enr-1")),
    ).rejects.toThrow("Cannot restore enrollment archived with its session");
  });
});
