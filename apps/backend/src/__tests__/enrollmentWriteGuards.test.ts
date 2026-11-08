import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import { ConflictError, SeatCapacityError } from "../lib/httpErrors.js";

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
  broadcastCollection: vi.fn(),
}));

vi.mock("../lib/cache/index.js", () => ({
  invalidateMultiTierCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../finance/use-cases/financeInvoiceGenerationUseCases.js", () => ({
  maybeGenerateInvoiceForEnrollment: (record: unknown) => Promise.resolve(record),
}));

const bulkSave = vi.hoisted(() => vi.fn());
const findActivelyEnrolled = vi.hoisted(() => vi.fn());
const findSession = vi.hoisted(() => vi.fn());
const findStudents = vi.hoisted(() => vi.fn());
const findTimezone = vi.hoisted(() => vi.fn());

vi.mock("../enrollments/use-cases/admissionsWaitlistExpiry.js", () => ({
  releaseOffersIfClassFull: vi.fn().mockResolvedValue(0),
  releaseOffersIfClassFullPostCommit: vi.fn().mockResolvedValue(undefined),
  expireWaitlistOffers: vi.fn().mockResolvedValue({ reverted: 0, workspaces: [] }),
}));

vi.mock("../enrollments/use-cases/enrollmentTimetableGuard.js", () => ({
  assertNoStudentScheduleCollision: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../enrollments/repository/admissionsRepositoryAdapter.js", () => ({
  admissionsRepository: {
    bulkSaveEnrollments: bulkSave,
    findActivelyEnrolledStudentIds: findActivelyEnrolled,
    findSessionById: findSession,
    findStudentsByIds: findStudents,
    findWorkspaceTimezone: findTimezone,
    cancelStudentEnrollmentsInSession: vi.fn(),
  },
}));

import { createEnrollmentsUseCases } from "../enrollments/use-cases/enrollmentsUseCases.js";
import type { EnrollmentsRepository } from "../enrollments/repository/enrollmentsRepository.js";
import { bulkEnrollStudentsIntoClass } from "../enrollments/use-cases/enrollmentBulkEnroll.js";
import { enrollmentWriteConflict } from "../db/repositories/enrollmentRepositoryPersist.js";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

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
    countEnrollmentsActive: vi.fn().mockResolvedValue(0),
    aggregateEnrollmentsCommandMetrics: vi.fn().mockResolvedValue({
      total: 0,
      confirmed: 0,
      pending: 0,
      cancelled: 0,
      completed: 0,
      revenue: 0,
      newThisPeriod: 0,
    }),
    aggregateEnrollmentsWidgetQueries: vi.fn().mockResolvedValue({}),
    loadEnrollmentsReportAggregates: vi.fn().mockResolvedValue({
      capacity: [],
      enrollmentTrends: [],
      todaysSessions: [],
    }),
  };
}

const activeDeps = {
  findStudentById: async () => ({ id: "s1" }),
  findSessionById: async () => ({ id: "sess1" }),
};

const fullEnrollment = {
  id: "enr-1",
  studentId: "s1",
  studentName: "Ali",
  sessionId: "sess1",
  sessionName: "Session",
  classId: "c1",
  className: "Class",
  enrolledDate: "2026-09-01",
  baseFee: 0,
  discountType: "none",
  discountLabel: "",
  discountPct: 0,
  discountAmt: 0,
  finalFee: 0,
  status: "pending" as const,
  paymentStatus: "none" as const,
  notes: "",
  timeline: [],
};

describe("enrollmentWriteConflict", () => {
  it("maps the live student/session unique index to a duplicate-enrollment conflict", () => {
    const mapped = enrollmentWriteConflict({
      code: "23505",
      constraint: "enrollments_live_student_session_uidx",
    });
    expect(mapped).toBeInstanceOf(ConflictError);
    expect(mapped?.message).toMatch(/already has an active enrollment/);
  });

  it("maps the section roll-number unique index to a roll-number conflict", () => {
    const mapped = enrollmentWriteConflict({
      cause: { code: "23505", constraint: "enrollments_section_roll_no_active_uidx" },
    });
    expect(mapped?.message).toMatch(/roll number/i);
  });

  it("leaves unrelated unique violations alone", () => {
    expect(
      enrollmentWriteConflict({
        code: "23505",
        constraint: "enrollments_workspace_subdomain_id_pk",
      }),
    ).toBeNull();
    expect(enrollmentWriteConflict(new Error("boom"))).toBeNull();
  });
});

describe("enrollment write provenance", () => {
  it("drops client-supplied soft-delete fields on create", async () => {
    const repo = createFakeRepo();
    const useCases = createEnrollmentsUseCases(repo, activeDeps);

    await runWithTenant("demo", () =>
      useCases.createEnrollment({
        ...fullEnrollment,
        deletedAt: "2026-01-01T00:00:00.000Z",
        deletedBy: "attacker",
        deletionReason: "sneaky",
        deletedWithCascade: true,
        restoredAt: "2026-01-02T00:00:00.000Z",
        restoredBy: "attacker",
      } as never),
    );

    const saved = (repo.saveEnrollment as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      Record<string, unknown> | undefined;
    expect(saved).toBeDefined();
    for (const field of [
      "deletedAt",
      "deletedBy",
      "deletionReason",
      "deletedWithCascade",
      "restoredAt",
      "restoredBy",
    ]) {
      expect(saved).not.toHaveProperty(field);
    }
  });

  it("refuses to resurrect an archived enrollment by re-creating its id", async () => {
    const repo = createFakeRepo();
    repo.findEnrollmentById = vi
      .fn()
      .mockResolvedValue({ ...fullEnrollment, deletedAt: "2026-01-01T00:00:00.000Z" });
    const useCases = createEnrollmentsUseCases(repo, activeDeps);

    await expect(
      runWithTenant("demo", () => useCases.createEnrollment({ ...fullEnrollment } as never)),
    ).rejects.toThrow(/archived enrollment/);
    expect(repo.saveEnrollment).not.toHaveBeenCalled();
  });

  it("preserves the stored cascade flag when a plain update sends one", async () => {
    const repo = createFakeRepo();
    const stored = { ...fullEnrollment, deletedAt: null, deletedWithCascade: false };
    repo.findEnrollmentById = vi.fn().mockResolvedValue(stored);
    const useCases = createEnrollmentsUseCases(repo, activeDeps);

    await runWithTenant("demo", () =>
      useCases.updateEnrollmentById("enr-1", { notes: "late fee", deletedWithCascade: true }),
    );

    const saved = (repo.saveEnrollment as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as
      Record<string, unknown> | undefined;
    expect(saved).toMatchObject({ notes: "late fee", deletedWithCascade: false });
  });

  it("refuses a restore that would duplicate the student's live session enrollment", async () => {
    const repo = createFakeRepo();
    repo.findEnrollmentById = vi.fn().mockResolvedValue({
      ...fullEnrollment,
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedWithCascade: false,
    });
    repo.findActiveEnrollmentInSession = vi.fn().mockResolvedValue({
      ...fullEnrollment,
      id: "enr-other",
    });
    const useCases = createEnrollmentsUseCases(repo, {
      findSessionById: async () => ({ id: "sess1" }),
      findStudentById: async () => ({ id: "s1" }),
    });

    await expect(
      runWithTenant("demo", () => useCases.restoreEnrollmentById("enr-1", "u-1")),
    ).rejects.toThrow(/already actively enrolled/);
  });

  it("refuses a standalone restore when the student is still archived", async () => {
    const repo = createFakeRepo();
    repo.findEnrollmentById = vi.fn().mockResolvedValue({
      ...fullEnrollment,
      deletedAt: "2026-01-01T00:00:00.000Z",
      deletedWithCascade: false,
    });
    const useCases = createEnrollmentsUseCases(repo, {
      findSessionById: async () => ({ id: "sess1" }),
      findStudentById: async () => ({ id: "s1", deletedAt: "2026-02-01T00:00:00.000Z" }),
    });

    await expect(
      runWithTenant("demo", () => useCases.restoreEnrollmentById("enr-1", "u-1")),
    ).rejects.toThrow(/student is archived/);
  });
});

describe("bulkEnrollStudentsIntoClass capacity handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findActivelyEnrolled.mockResolvedValue(new Set());
    findTimezone.mockResolvedValue("UTC");
    findSession.mockResolvedValue({
      id: "sess1",
      name: "Session",
      status: "in_progress",
      startDate: "2026-01-01",
      deletedAt: null,
      baseFee: 0,
      classes: [{ id: "c1", name: "Class", fees: [], discounts: [] }],
    });
    findStudents.mockResolvedValue([
      { id: "s1", name: "Ali", deletedAt: null },
      { id: "s2", name: "Omar", deletedAt: null },
    ]);
  });

  it("reports the rows the database actually wrote", async () => {
    bulkSave.mockResolvedValue({ inserted: ["enr-a", "enr-b"] });

    const result = await runWithTenant("demo", () =>
      bulkEnrollStudentsIntoClass("demo", {
        studentIds: ["s1", "s2"],
        sessionId: "sess1",
        classId: "c1",
        mode: "add",
      }),
    );

    expect(result).toEqual({ succeeded: 2, failed: 0 });
  });

  it("retries row by row when the batch hits a full section", async () => {
    bulkSave
      .mockRejectedValueOnce(new SeatCapacityError("Class is full", "sec-1", 0))
      .mockResolvedValueOnce({ inserted: ["enr-a"] })
      .mockRejectedValueOnce(new SeatCapacityError("Class is full", "sec-1", 0));

    const result = await runWithTenant("demo", () =>
      bulkEnrollStudentsIntoClass("demo", {
        studentIds: ["s1", "s2"],
        sessionId: "sess1",
        classId: "c1",
        mode: "add",
      }),
    );

    expect(result).toEqual({ succeeded: 1, failed: 1 });
    expect(bulkSave).toHaveBeenCalledTimes(3);
  });

  it("counts already-enrolled students and students the unique index rejected as failed", async () => {
    bulkSave.mockResolvedValue({ inserted: ["enr-a"] });

    const result = await runWithTenant("demo", () =>
      bulkEnrollStudentsIntoClass("demo", {
        studentIds: ["s1", "s2", "s3"],
        sessionId: "sess1",
        classId: "c1",
        mode: "add",
      }),
    );

    expect(result).toEqual({ succeeded: 1, failed: 2 });
  });
});
