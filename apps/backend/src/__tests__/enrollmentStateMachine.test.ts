import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import { createEnrollmentsUseCases } from "../enrollments/use-cases/enrollmentsUseCases.js";
import type { EnrollmentsRepository } from "../enrollments/repository/enrollmentsRepository.js";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

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

const record = {
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

function fakeRepo(overrides: Partial<EnrollmentsRepository> = {}): EnrollmentsRepository {
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
    ...overrides,
  };
}

const deps = {
  findStudentById: async () => ({ id: "s1", dob: "2018-01-01", gender: "male" }),
  findSessionById: async () => ({ id: "sess1", status: "in_progress", startDate: "2026-01-01" }),
};

describe("enrollment state machine (use cases)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses to create an enrollment in a terminal status", async () => {
    const repo = fakeRepo();
    const useCases = createEnrollmentsUseCases(repo, deps);

    await expect(
      runWithTenant("demo", () =>
        useCases.createEnrollment({ ...record, status: "completed" } as never),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.saveEnrollment).not.toHaveBeenCalled();
  });

  it("refuses an illegal manual transition (completed → confirmed)", async () => {
    const repo = fakeRepo({
      findEnrollmentById: vi.fn().mockResolvedValue({
        ...record,
        status: "completed",
        deletedAt: null,
      }),
    });
    const useCases = createEnrollmentsUseCases(repo, deps);

    await expect(
      runWithTenant("demo", () =>
        useCases.updateEnrollmentById("enr-1", { status: "confirmed" } as never),
      ),
    ).rejects.toMatchObject({ statusCode: 409, type: "invalid_status_transition" });
    expect(repo.saveEnrollment).not.toHaveBeenCalled();
  });

  it("allows the manual pending → confirmed edge through the guarded update", async () => {
    const stored = { ...record, deletedAt: null };
    const transition = vi.fn().mockResolvedValue(undefined);
    const repo = fakeRepo({
      findEnrollmentById: vi.fn().mockResolvedValue(stored),
      saveEnrollment: vi.fn().mockResolvedValue(undefined),
      transitionEnrollmentStatusTx: transition,
    });
    const useCases = createEnrollmentsUseCases(repo, deps);

    await runWithTenant("demo", () =>
      useCases.updateEnrollmentById("enr-1", { status: "confirmed" } as never),
    );

    expect(transition).toHaveBeenCalledWith(expect.anything(), "demo", {
      id: "enr-1",
      from: "pending",
      to: "confirmed",
    });
    expect(repo.saveEnrollment).toHaveBeenCalled();
  });

  it("does not run the transition guard when the status is unchanged", async () => {
    const transition = vi.fn().mockResolvedValue(undefined);
    const repo = fakeRepo({
      findEnrollmentById: vi.fn().mockResolvedValue({ ...record, deletedAt: null }),
      transitionEnrollmentStatusTx: transition,
    });
    const useCases = createEnrollmentsUseCases(repo, deps);

    await runWithTenant("demo", () =>
      useCases.updateEnrollmentById("enr-1", { notes: "late fee" } as never),
    );

    expect(transition).not.toHaveBeenCalled();
    expect(repo.saveEnrollment).toHaveBeenCalled();
  });
});
