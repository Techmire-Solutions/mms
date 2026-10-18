import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { adminToken } from "./helpers/tokens.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/auth/authArtifactService.js", () => ({
  purgeExpiredAuthArtifacts: vi.fn().mockResolvedValue(undefined),
  putAuthArtifact: vi.fn(),
  takeAuthArtifact: vi.fn(),
}));

vi.mock("../services/workspaceService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/workspaceService.js")>();
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    ...actual,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
});

const mockDeleteEnrollmentById = vi.fn();
const mockRestoreEnrollmentById = vi.fn();
const mockDeleteAttendanceRecordById = vi.fn();
const mockRestoreAttendanceRecordById = vi.fn();
const mockDeleteInvoiceById = vi.fn();
const mockRestoreInvoiceById = vi.fn();
const mockDeletePaymentById = vi.fn();
const mockRestorePaymentById = vi.fn();

vi.mock("../enrollments/use-cases/enrollmentsUseCases.js", () => ({
  enrollmentsUseCases: {
    createEnrollment: vi.fn(),
    updateEnrollmentById: vi.fn(),
    deleteEnrollmentById: (...args: unknown[]) => mockDeleteEnrollmentById(...args),
    restoreEnrollmentById: (...args: unknown[]) => mockRestoreEnrollmentById(...args),
    countEnrollments: vi.fn().mockResolvedValue(0),
    loadEnrollmentsPage: vi
      .fn()
      .mockResolvedValue({ enrollments: [], total: 0, page: 1, limit: 12, hasMore: false }),
    loadEnrollmentsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadEnrollmentsWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadEnrollmentsReportAggregates: vi.fn().mockResolvedValue({}),
    bulkSoftDeleteEnrollments: vi.fn(),
    bulkRestoreEnrollments: vi.fn(),
    loadEnrollmentsByIds: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../attendance/use-cases/attendanceUseCases.js", () => ({
  attendanceUseCases: {
    loadAttendanceRecords: vi.fn().mockResolvedValue([]),
    loadAttendancePage: vi
      .fn()
      .mockResolvedValue({ records: [], total: 0, page: 1, limit: 15, hasMore: false }),
    countAttendanceRecords: vi.fn().mockResolvedValue(0),
    loadAttendanceCommandMetrics: vi.fn().mockResolvedValue({}),
    createAttendanceRecord: vi.fn(),
    updateAttendanceRecordById: vi.fn(),
    replaceAttendanceRecords: vi.fn(),
    upsertAttendanceRecords: vi.fn(),
    bulkSoftDeleteAttendance: vi.fn(),
    bulkRestoreAttendance: vi.fn(),
    deleteAttendanceRecordById: (...args: unknown[]) => mockDeleteAttendanceRecordById(...args),
    restoreAttendanceRecordById: (...args: unknown[]) => mockRestoreAttendanceRecordById(...args),
    loadAttendanceWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadAttendanceReportAggregates: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../finance/use-cases/financeUseCases.js", () => ({
  financeUseCases: {
    loadInvoices: vi.fn().mockResolvedValue([]),
    loadInvoicesPage: vi
      .fn()
      .mockResolvedValue({ invoices: [], total: 0, page: 1, limit: 10, hasMore: false }),
    createInvoice: vi.fn(),
    updateInvoiceById: vi.fn(),
    deleteInvoiceById: (...args: unknown[]) => mockDeleteInvoiceById(...args),
    restoreInvoiceById: (...args: unknown[]) => mockRestoreInvoiceById(...args),
    bulkSoftDeleteInvoices: vi.fn(),
    bulkRestoreInvoices: vi.fn(),
    getInvoiceById: vi.fn(),
    bulkUpdateInvoicesStatus: vi.fn(),
    loadPayments: vi.fn().mockResolvedValue([]),
    loadPaymentsPage: vi
      .fn()
      .mockResolvedValue({ payments: [], total: 0, page: 1, limit: 10, hasMore: false }),
    createPayment: vi.fn(),
    updatePaymentById: vi.fn(),
    deletePaymentById: (...args: unknown[]) => mockDeletePaymentById(...args),
    restorePaymentById: (...args: unknown[]) => mockRestorePaymentById(...args),
    bulkSoftDeletePayments: vi.fn(),
    bulkRestorePayments: vi.fn(),
    getPaymentById: vi.fn(),
    loadFinanceCommandMetrics: vi.fn().mockResolvedValue({}),
    loadFinanceWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadFinanceReportAggregates: vi.fn().mockResolvedValue({}),
  },
}));

const mockDeleteObligationCollectionById = vi.fn();
const mockRestoreObligationCollectionById = vi.fn();
const mockDeleteHasanatDistributionById = vi.fn();
const mockRestoreHasanatDistributionById = vi.fn();

vi.mock("../obligations/use-cases/obligationsUseCases.js", () => ({
  obligationsUseCases: {
    loadObligationTypes: vi.fn().mockResolvedValue([]),
    upsertObligationTypes: vi.fn(),
    loadMujtahids: vi.fn().mockResolvedValue([]),
    upsertMujtahids: vi.fn(),
    loadMujtahidReps: vi.fn().mockResolvedValue([]),
    upsertMujtahidReps: vi.fn(),
    loadWakalaTypes: vi.fn().mockResolvedValue([]),
    upsertWakalaTypes: vi.fn(),
    loadObligationDistributions: vi.fn().mockResolvedValue([]),
    upsertObligationDistributions: vi.fn(),
    loadObligationCollections: vi.fn().mockResolvedValue([]),
    upsertObligationCollections: vi.fn(),
    deleteObligationCollectionById: (...args: unknown[]) =>
      mockDeleteObligationCollectionById(...args),
    restoreObligationCollectionById: (...args: unknown[]) =>
      mockRestoreObligationCollectionById(...args),
    bulkSoftDeleteObligationCollections: vi.fn(),
    bulkRestoreObligationCollections: vi.fn(),
    loadObligationsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadObligationsReportAggregates: vi.fn().mockResolvedValue({}),
    replaceObligationTypes: vi.fn(),
    replaceMujtahids: vi.fn(),
    replaceMujtahidReps: vi.fn(),
    replaceWakalaTypes: vi.fn(),
    replaceObligationDistributions: vi.fn(),
    replaceObligationCollections: vi.fn(),
  },
}));

vi.mock("../hasanat/use-cases/hasanatUseCases.js", () => ({
  hasanatUseCases: {
    loadDenoms: vi.fn().mockResolvedValue([]),
    upsertDenoms: vi.fn(),
    loadBatches: vi.fn().mockResolvedValue([]),
    upsertBatches: vi.fn(),
    loadDistributions: vi.fn().mockResolvedValue([]),
    loadDistributionsPage: vi
      .fn()
      .mockResolvedValue({ distributions: [], total: 0, page: 1, limit: 15, hasMore: false }),
    upsertDistributions: vi.fn(),
    loadRedemptions: vi.fn().mockResolvedValue([]),
    upsertRedemptions: vi.fn(),
    deleteDistributionById: (...args: unknown[]) => mockDeleteHasanatDistributionById(...args),
    restoreDistributionById: (...args: unknown[]) => mockRestoreHasanatDistributionById(...args),
    bulkSoftDeleteDistributions: vi.fn(),
    bulkRestoreDistributions: vi.fn(),
    loadHasanatReportAggregates: vi.fn().mockResolvedValue({
      comparison: { sessions: [], monthly: { a: [], b: [] } },
    }),
    loadHasanatCommandMetrics: vi.fn().mockResolvedValue({}),
    loadHasanatWidgetAggregates: vi.fn().mockResolvedValue({}),
    createDistribution: vi.fn(),
    updateDistributionById: vi.fn(),
    replaceDenoms: vi.fn(),
    replaceBatches: vi.fn(),
    replaceDistributions: vi.fn(),
    replaceRedemptions: vi.fn(),
  },
}));

const mockDeleteExamById = vi.fn();
const mockRestoreExamById = vi.fn();

vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: {
    loadExams: vi.fn().mockResolvedValue([]),
    loadExamsPage: vi
      .fn()
      .mockResolvedValue({ exams: [], total: 0, page: 1, limit: 12, hasMore: false }),
    upsertExams: vi.fn(),
    loadExamResults: vi.fn().mockResolvedValue([]),
    upsertExamResults: vi.fn(),
    deleteExamById: (...args: unknown[]) => mockDeleteExamById(...args),
    restoreExamById: (...args: unknown[]) => mockRestoreExamById(...args),
    bulkSoftDeleteExams: vi.fn(),
    bulkRestoreExams: vi.fn(),
    loadExaminationsCommandMetrics: vi.fn().mockResolvedValue({}),
    loadExaminationsWidgetAggregates: vi.fn().mockResolvedValue({}),
    loadExaminationsReportAggregates: vi.fn().mockResolvedValue({}),
    replaceExams: vi.fn(),
    replaceExamResults: vi.fn(),
  },
}));

const mockDeleteUserById = vi.fn();
const mockRestoreUserById = vi.fn();

vi.mock("../users/use-cases/usersUseCases.js", () => ({
  usersUseCases: {
    loadWorkspaceUsers: vi.fn().mockResolvedValue([]),
    upsertWorkspaceUsers: vi.fn(),
    loadLogs: vi.fn().mockResolvedValue([]),
    upsertLogs: vi.fn(),
    deleteUserById: (...args: unknown[]) => mockDeleteUserById(...args),
    restoreUserById: (...args: unknown[]) => mockRestoreUserById(...args),
    bulkSoftDeleteUsers: vi.fn(),
    bulkRestoreUsers: vi.fn(),
    countUsers: vi.fn().mockResolvedValue(0),
    loadUsersCommandMetrics: vi.fn().mockResolvedValue({}),
    loadUsersPage: vi
      .fn()
      .mockResolvedValue({ users: [], total: 0, page: 1, limit: 50, hasMore: false }),
    loadUsersByIds: vi.fn().mockResolvedValue([]),
    createWorkspaceUser: vi.fn(),
    updateWorkspaceUser: vi.fn(),
    inviteWorkspaceUser: vi.fn(),
    verifyUserEmailById: vi.fn(),
    resetUserPasswordById: vi.fn(),
  },
}));

describe("soft deletion and restore integrations", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  // --- Enrollments ---
  it("DELETE /api/enrollments/:id soft-deletes enrollment", async () => {
    mockDeleteEnrollmentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/enrollments/e1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Dropped class" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteEnrollmentById).toHaveBeenCalledWith("e1", "u-admin", "Dropped class");
    await app.close();
  });

  it("POST /api/enrollments/:id/restore restores enrollment", async () => {
    mockRestoreEnrollmentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/e1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreEnrollmentById).toHaveBeenCalledWith("e1", "u-admin");
    await app.close();
  });

  // --- Attendance ---
  it("DELETE /api/attendance/:id soft-deletes attendance record", async () => {
    mockDeleteAttendanceRecordById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/attendance/a1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Error input" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteAttendanceRecordById).toHaveBeenCalledWith("a1", "u-admin", "Error input");
    await app.close();
  });

  it("POST /api/attendance/:id/restore restores attendance record", async () => {
    mockRestoreAttendanceRecordById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/attendance/a1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreAttendanceRecordById).toHaveBeenCalledWith("a1", "u-admin");
    await app.close();
  });

  // --- Finance Invoices ---
  it("DELETE /api/finance/invoices/:id soft-deletes invoice", async () => {
    mockDeleteInvoiceById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/finance/invoices/i1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Billing error" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteInvoiceById).toHaveBeenCalledWith("i1", "u-admin", "Billing error");
    await app.close();
  });

  it("POST /api/finance/invoices/:id/restore restores invoice", async () => {
    mockRestoreInvoiceById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/finance/invoices/i1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreInvoiceById).toHaveBeenCalledWith("i1", "u-admin");
    await app.close();
  });

  // --- Finance Payments ---
  it("DELETE /api/finance/payments/:id soft-deletes payment", async () => {
    mockDeletePaymentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/finance/payments/p1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
      payload: { deletionReason: "Refunded" },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeletePaymentById).toHaveBeenCalledWith("p1", "u-admin", "Refunded");
    await app.close();
  });

  it("POST /api/finance/payments/:id/restore restores payment", async () => {
    mockRestorePaymentById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/finance/payments/p1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestorePaymentById).toHaveBeenCalledWith("p1", "u-admin");
    await app.close();
  });

  it("DELETE /api/obligations/collections/:id soft-deletes collection", async () => {
    mockDeleteObligationCollectionById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/obligations/collections/oc1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteObligationCollectionById).toHaveBeenCalledWith("oc1", "u-admin");
    await app.close();
  });

  it("POST /api/obligations/collections/:id/restore restores collection", async () => {
    mockRestoreObligationCollectionById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/obligations/collections/oc1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreObligationCollectionById).toHaveBeenCalledWith("oc1", "u-admin");
    await app.close();
  });

  it("DELETE /api/hasanat/distributions/:id soft-deletes distribution", async () => {
    mockDeleteHasanatDistributionById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/hasanat/distributions/dist1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteHasanatDistributionById).toHaveBeenCalledWith("dist1", "u-admin");
    await app.close();
  });

  it("POST /api/hasanat/distributions/:id/restore restores distribution", async () => {
    mockRestoreHasanatDistributionById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/hasanat/distributions/dist1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreHasanatDistributionById).toHaveBeenCalledWith("dist1", "u-admin");
    await app.close();
  });

  it("DELETE /api/examinations/exams/:id soft-deletes exam", async () => {
    mockDeleteExamById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/examinations/exams/ex1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteExamById).toHaveBeenCalledWith("ex1", "u-admin");
    await app.close();
  });

  it("POST /api/examinations/exams/:id/restore restores exam", async () => {
    mockRestoreExamById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/examinations/exams/ex1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreExamById).toHaveBeenCalledWith("ex1", "u-admin");
    await app.close();
  });

  it("DELETE /api/users/:id soft-deletes user", async () => {
    mockDeleteUserById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: "/api/users/u-1",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDeleteUserById).toHaveBeenCalledWith("u-1", "u-admin", "admin");
    await app.close();
  });

  it("POST /api/users/:id/restore restores user", async () => {
    mockRestoreUserById.mockResolvedValue(true);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(mockRestoreUserById).toHaveBeenCalledWith("u-1", "admin", "u-admin", "127.0.0.1");
    await app.close();
  });

  it("POST /api/users/:id/restore returns 409 conflict when code is 23505", async () => {
    const error = new Error("duplicate key value violates unique constraint");
    Object.assign(error, { code: "23505" });
    mockRestoreUserById.mockRejectedValue(error);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/users/u-1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual(expect.objectContaining({ type: "conflict" }));
    await app.close();
  });

  it("POST /api/enrollments/:id/restore returns 409 conflict when code is 23505", async () => {
    const error = new Error("duplicate key value violates unique constraint");
    Object.assign(error, { code: "23505" });
    mockRestoreEnrollmentById.mockRejectedValue(error);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/enrollments/enr-1/restore",
      headers: {
        host: "demo.localhost",
        authorization: `Bearer ${adminToken(app)}`,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      type: "conflict",
      message: "A record with this unique identifier already exists",
    });
    await app.close();
  });
});
