import { describe, expect, it, vi } from "vitest";
import { createEnrollmentsUseCases } from "../enrollments/use-cases/enrollmentsUseCases.js";
import type { EnrollmentsRepository } from "../enrollments/repository/enrollmentsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

function createFakeRepo(): EnrollmentsRepository {
  return {
    listEnrollmentsByWorkspace: vi.fn().mockResolvedValue([]),
    findEnrollmentById: vi.fn().mockResolvedValue(null),
    findEnrollmentsByIds: vi.fn().mockResolvedValue([]),
    saveEnrollment: vi.fn().mockResolvedValue(undefined),
    listEnrollmentsPage: vi.fn().mockResolvedValue({
      enrollments: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    countEnrollmentsActive: vi.fn().mockResolvedValue(5),
    aggregateEnrollmentsCommandMetrics: vi.fn().mockResolvedValue({
      total: 5,
      confirmed: 3,
      pending: 1,
      cancelled: 0,
      completed: 1,
      revenue: 0,
      newThisPeriod: 2,
    }),
    aggregateEnrollmentsWidgetQueries: vi.fn().mockResolvedValue({}),
    loadEnrollmentsReportAggregates: vi.fn().mockResolvedValue({
      capacity: [],
      enrollmentTrends: [],
      todaysSessions: [],
    }),
  };
}

describe("enrollments use-cases (DI with fake repository)", () => {
  it("countEnrollments delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createEnrollmentsUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.countEnrollments());

    expect(result).toBe(5);
    expect(repo.countEnrollmentsActive).toHaveBeenCalledWith("demo");
  });

  it("loadEnrollmentsPage delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createEnrollmentsUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadEnrollmentsPage({ page: 2, limit: 12 }),
    );

    expect(result).toEqual({ enrollments: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.listEnrollmentsPage).toHaveBeenCalledWith("demo", { page: 2, limit: 12 });
  });

  it("loadEnrollmentsCommandMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createEnrollmentsUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadEnrollmentsCommandMetrics());

    expect(result.total).toBe(5);
    expect(repo.aggregateEnrollmentsCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createEnrollmentsUseCases(repo);

    const count = await useCases.countEnrollments();
    const page = await useCases.loadEnrollmentsPage({ page: 1, limit: 12 });

    expect(count).toBe(0);
    expect(page).toEqual({ enrollments: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.countEnrollmentsActive).not.toHaveBeenCalled();
    expect(repo.listEnrollmentsPage).not.toHaveBeenCalled();
  });

  it("loadEnrollmentsByIds deduplicates trimmed IDs and filters out soft-deleted enrollments", async () => {
    const repo = createFakeRepo();
    const active = { id: "enr-1", studentName: "Ali" } as any;
    const deleted = {
      id: "enr-2",
      studentName: "Omar",
      deletedAt: "2026-03-01T00:00:00.000Z",
    } as any;
    repo.findEnrollmentsByIds = vi.fn().mockImplementation((_tenant, _ids, options) => {
      return Promise.resolve(options?.includeDeleted ? [active, deleted] : [active]);
    });
    const useCases = createEnrollmentsUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadEnrollmentsByIds([" enr-1 ", "enr-2", "enr-1", "   "]),
    );

    expect(repo.findEnrollmentsByIds).toHaveBeenCalledWith("demo", ["enr-1", "enr-2"], {
      includeDeleted: false,
    });
    expect(result).toEqual([active]);
  });

  it("loadEnrollmentById filters soft-deleted enrollments unless includeDeleted is true", async () => {
    const repo = createFakeRepo();
    const deleted = {
      id: "enr-deleted",
      studentName: "Zayd",
      deletedAt: "2026-03-01T00:00:00.000Z",
    } as any;
    repo.findEnrollmentById = vi.fn().mockResolvedValue(deleted);
    const useCases = createEnrollmentsUseCases(repo);

    const activeResult = await runWithTenant("demo", () =>
      useCases.loadEnrollmentById("enr-deleted", false),
    );
    expect(activeResult).toBeNull();

    const deletedResult = await runWithTenant("demo", () =>
      useCases.loadEnrollmentById("enr-deleted", true),
    );
    expect(deletedResult).toEqual(deleted);
  });

  it("createEnrollment throws 400 when student is archived", async () => {
    const repo = createFakeRepo();
    const findStudentById = vi
      .fn()
      .mockResolvedValue({ id: "s1", deletedAt: "2026-01-01T00:00:00.000Z" });
    const findSessionById = vi.fn().mockResolvedValue({ id: "sess1" });
    const useCases = createEnrollmentsUseCases(repo, { findStudentById, findSessionById });

    await expect(
      runWithTenant("demo", () =>
        useCases.createEnrollment({
          studentId: "s1",
          sessionId: "sess1",
          classId: "c1",
          enrolledDate: "2026-09-01",
        } as any),
      ),
    ).rejects.toThrow("Referenced student is archived or does not exist");
  });

  it("createEnrollment throws 400 when session is archived", async () => {
    const repo = createFakeRepo();
    const findStudentById = vi.fn().mockResolvedValue({ id: "s1" });
    const findSessionById = vi
      .fn()
      .mockResolvedValue({ id: "sess1", deletedAt: "2026-01-01T00:00:00.000Z" });
    const useCases = createEnrollmentsUseCases(repo, { findStudentById, findSessionById });

    await expect(
      runWithTenant("demo", () =>
        useCases.createEnrollment({
          studentId: "s1",
          sessionId: "sess1",
          classId: "c1",
          enrolledDate: "2026-09-01",
        } as any),
      ),
    ).rejects.toThrow("Referenced session is archived or does not exist");
  });

  it("updateEnrollmentById throws 400 when referenced student is archived", async () => {
    const repo = createFakeRepo();
    const findStudentById = vi
      .fn()
      .mockResolvedValue({ id: "s1", deletedAt: "2026-01-01T00:00:00.000Z" });
    const useCases = createEnrollmentsUseCases(repo, { findStudentById });

    await expect(
      runWithTenant("demo", () =>
        useCases.updateEnrollmentById("enr-1", {
          studentId: "s1",
        } as any),
      ),
    ).rejects.toThrow("Referenced student is archived or does not exist");
  });

  it("updateEnrollmentById throws 400 when referenced session is archived", async () => {
    const repo = createFakeRepo();
    const findSessionById = vi
      .fn()
      .mockResolvedValue({ id: "sess1", deletedAt: "2026-01-01T00:00:00.000Z" });
    const useCases = createEnrollmentsUseCases(repo, { findSessionById });

    await expect(
      runWithTenant("demo", () =>
        useCases.updateEnrollmentById("enr-1", {
          sessionId: "sess1",
        } as any),
      ),
    ).rejects.toThrow("Referenced session is archived or does not exist");
  });
});
