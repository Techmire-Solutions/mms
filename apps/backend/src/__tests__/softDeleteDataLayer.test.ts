import { describe, expect, it, vi, beforeEach } from "vitest";
import { wrapDbWithRelationalGuardrails } from "../db/dbClient.js";
import {
  buildTenantSoftDeleteConditions,
  createGenericRelationalService,
  filterInMemorySoftDeleted,
  type TenantSoftDeleteTable,
} from "../services/genericRelationalService.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/httpErrors.js";
import {
  restoreContactById,
  bulkRestoreContacts,
} from "../contacts/use-cases/contactSoftDeleteUseCases.js";
import {
  restoreFacultyById,
  bulkRestoreFaculty,
} from "../faculty/use-cases/facultySoftDeleteUseCases.js";
import {
  restoreStudentById,
  bulkRestoreStudents,
} from "../students/use-cases/studentRestoreUseCases.js";
import { StudentRestoreConflictError } from "../students/use-cases/studentNormalizeUseCases.js";
import { createEnrollmentsUseCases } from "../enrollments/use-cases/enrollmentsUseCases.js";
import { createFinanceUseCases } from "../finance/use-cases/financeUseCases.js";
import { createAttendanceUseCases } from "../attendance/use-cases/attendanceUseCases.js";
import { createSessionsUseCases } from "../sessions/use-cases/sessionsUseCases.js";
import type { ContactsRepository } from "../contacts/repository/contactsRepository.js";
import type { FacultyRepository } from "../faculty/repository/facultyRepository.js";
import type { StudentsRepository } from "../students/repository/studentsRepository.js";
import type { EnrollmentsRepository } from "../enrollments/repository/enrollmentsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";
import { withTenant, withTenantRead } from "../db/tenant-context.js";
import { z } from "zod";
import {
  bulkSoftDeleteInvoices,
  findInvoicesByIds,
} from "../db/repositories/financeInvoicesRepository.js";
import { bulkSoftDeleteAccounts } from "../db/repositories/accountingAccountsRepository.js";
import {
  softDeleteSessionWithCascade,
  restoreSessionWithCascade,
} from "../db/repositories/sessionRepositoryPersist.js";
import { findPaymentsByIds } from "../db/repositories/financePaymentsRepository.js";
import { findEnrollmentsByIds } from "../db/repositories/enrollmentRepositoryHydrate.js";
vi.mock("../attendance/use-cases/attendanceSectionStamp.js", () => ({
  stampAttendanceSections: vi.fn(async (_tenant: string, records: unknown[]) => records),
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: vi.fn((cb: () => unknown) => cb()),
  activeDb: () => ({
    execute: async () => undefined,
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
  hasActiveTransaction: () => true,
}));

vi.mock("../db/repositories/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
  restoreCascadedEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/softDeleteHelpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/softDeleteHelpers.js")>();
  return {
    ...actual,
    enableIncludeDeleted: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: vi.fn().mockResolvedValue(undefined),
  broadcastTenantUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../services/outboxEventService.js", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({
    id: 1,
    hashPrevious: "0".repeat(64),
    hashCurrent: "a".repeat(64),
    canonicalPayload: "{}",
  }),
  sanitizeAuditState: (v: unknown) => v,
}));

vi.mock("../contacts/use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: vi.fn().mockResolvedValue(undefined),
}));

const defaultReadTx = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
};

vi.mock("../db/tenant-context.js", () => ({
  withTenant: vi.fn(),
  withTenantRead: vi.fn((_subdomain, cb) => cb?.(defaultReadTx as any)),
}));

describe("Soft-Delete Data Layer & Relational Guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTenantRead).mockImplementation(async (_subdomain, cb) =>
      cb(defaultReadTx as any),
    );
  });

  describe("1. Relational Query Guardrails (wrapDbWithRelationalGuardrails)", () => {
    it("automatically injects where: isNull(relation.deletedAt) when with: { [rel]: true }", async () => {
      let capturedOptions: any = null;
      const fakeMethod = vi.fn((opts) => {
        capturedOptions = opts;
        return Promise.resolve({ id: "sess-1" });
      });

      const fakeDb = {
        query: {
          sessions: {
            findFirst: fakeMethod,
            findMany: fakeMethod,
          },
        },
      };

      const wrappedDb = wrapDbWithRelationalGuardrails(fakeDb);
      await wrappedDb.query.sessions.findFirst({
        with: {
          enrollments: true,
        },
      });

      expect(fakeMethod).toHaveBeenCalled();
      expect(capturedOptions).toBeDefined();
      expect(typeof capturedOptions.with.enrollments).toBe("object");
      expect(typeof capturedOptions.with.enrollments.where).toBe("function");

      // Test the injected where helper
      const isNullSpy = vi.fn((col) => ({ op: "isNull", col }));
      const relationWithDeletedAt = { deletedAt: "col_deleted_at" };
      const predicate = capturedOptions.with.enrollments.where(relationWithDeletedAt, {
        isNull: isNullSpy,
      });

      expect(isNullSpy).toHaveBeenCalledWith("col_deleted_at");
      expect(predicate).toEqual({ op: "isNull", col: "col_deleted_at" });
    });

    it("verifies that nested relations in db.query.sessions.findFirst({ with: { enrollments: true } }) do not include soft-deleted enrollments", async () => {
      const allEnrollments = [
        { id: "enr-1", sessionId: "sess-1", status: "enrolled", deletedAt: null },
        {
          id: "enr-2",
          sessionId: "sess-1",
          status: "enrolled",
          deletedAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        { id: "enr-3", sessionId: "sess-1", status: "enrolled", deletedAt: null },
      ];

      const fakeFindFirst = vi.fn(async (opts: any) => {
        const whereHelper = opts?.with?.enrollments?.where;
        const isNullFn = (val: any) => val === null || val === undefined;
        const filteredEnrollments = allEnrollments.filter((enrollment) => {
          if (!whereHelper) return true;
          return Boolean(whereHelper(enrollment, { isNull: isNullFn }));
        });

        return {
          id: "sess-1",
          name: "Summer Camp 2026",
          enrollments: filteredEnrollments,
        };
      });

      const fakeDb = {
        query: {
          sessions: {
            findFirst: fakeFindFirst,
          },
        },
      };

      const wrappedDb = wrapDbWithRelationalGuardrails(fakeDb);
      const result = await wrappedDb.query.sessions.findFirst({
        with: {
          enrollments: true,
        },
      });

      expect(fakeFindFirst).toHaveBeenCalled();
      expect(result.enrollments).toHaveLength(2);
      expect(result.enrollments.map((e: any) => e.id)).toEqual(["enr-1", "enr-3"]);
      expect(result.enrollments.some((e: any) => e.id === "enr-2")).toBe(false);
    });

    it("combines custom where conditions with isNull(relation.deletedAt) using and(...)", async () => {
      let capturedOptions: any = null;
      const fakeMethod = vi.fn((opts) => {
        capturedOptions = opts;
        return Promise.resolve([]);
      });

      const fakeDb = {
        query: {
          sessions: {
            findFirst: fakeMethod,
            findMany: fakeMethod,
          },
        },
      };

      const wrappedDb = wrapDbWithRelationalGuardrails(fakeDb);
      const customWhere = vi.fn((rel: any, helpers: any) => helpers.eq(rel.status, "enrolled"));

      await wrappedDb.query.sessions.findMany({
        with: {
          enrollments: {
            columns: { id: true, studentId: true },
            where: customWhere,
          },
        },
      });

      expect(capturedOptions.with.enrollments.columns).toEqual({ id: true, studentId: true });
      expect(typeof capturedOptions.with.enrollments.where).toBe("function");

      const isNullSpy = vi.fn((col) => `isNull(${col})`);
      const eqSpy = vi.fn((col, val) => `eq(${col},${val})`);
      const andSpy = vi.fn((...conds) => `and(${conds.join(",")})`);

      const relationWithDeletedAt = { deletedAt: "col_deleted_at", status: "col_status" };
      const combined = capturedOptions.with.enrollments.where(relationWithDeletedAt, {
        isNull: isNullSpy,
        eq: eqSpy,
        and: andSpy,
      });

      expect(customWhere).toHaveBeenCalled();
      expect(isNullSpy).toHaveBeenCalledWith("col_deleted_at");
      expect(andSpy).toHaveBeenCalledWith("eq(col_status,enrolled)", "isNull(col_deleted_at)");
      expect(combined).toBe("and(eq(col_status,enrolled),isNull(col_deleted_at))");
    });

    it("does not alter relation where when relation table does not have deletedAt", async () => {
      let capturedOptions: any = null;
      const fakeMethod = vi.fn((opts) => {
        capturedOptions = opts;
        return Promise.resolve({ id: "sess-1" });
      });

      const fakeDb = {
        query: {
          sessions: {
            findFirst: fakeMethod,
          },
        },
      };

      const wrappedDb = wrapDbWithRelationalGuardrails(fakeDb);
      await wrappedDb.query.sessions.findFirst({
        with: {
          timetable: true,
        },
      });

      const isNullSpy = vi.fn();
      const relationWithoutDeletedAt = { id: "col_id", activity: "col_activity" };
      const predicate = capturedOptions.with.timetable.where(relationWithoutDeletedAt, {
        isNull: isNullSpy,
      });

      expect(isNullSpy).not.toHaveBeenCalled();
      expect(predicate).toBeUndefined();
    });
  });

  describe("2. Uniqueness-on-Restore & Conflict Handling (restoreContactById)", () => {
    function createFakeContactsRepo(): ContactsRepository {
      return {
        countByWorkspace: vi.fn().mockResolvedValue(0),
        listPage: vi
          .fn()
          .mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 12, hasMore: false }),
        findById: vi.fn().mockResolvedValue(null),
        findByIds: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockResolvedValue(undefined),
        bulkSave: vi.fn().mockResolvedValue(undefined),
        bulkSoftDelete: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
        bulkRestore: vi.fn().mockResolvedValue({ succeeded: 1, failed: 0 }),
        findExistingNormalizedContactNames: vi.fn().mockResolvedValue(new Set()),
        findActiveContactsMatchingUniqueValues: vi.fn().mockResolvedValue([]),
        findContactDuplicateCandidateIds: vi.fn().mockResolvedValue([]),
        findContactDuplicateBlockedIds: vi.fn().mockResolvedValue([]),
      } as unknown as ContactsRepository;
    }

    it("throws ConflictError (409) when an active contact already owns the same email", async () => {
      const repo = createFakeContactsRepo();
      vi.mocked(repo.findById).mockResolvedValue({
        id: "c-archived",
        firstName: "Zayd",
        lastName: "Ali",
        email: "zayd@example.com",
        deletedAt: "2026-05-01T00:00:00.000Z",
      } as any);

      vi.mocked(repo.findActiveContactsMatchingUniqueValues).mockResolvedValue([
        {
          id: "c-active-conflict",
          firstName: "Zayd",
          lastName: "Hassan",
          email: "zayd@example.com",
        } as any,
      ]);

      await expect(
        runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
      ).rejects.toThrow(ConflictError);

      await expect(
        runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
      ).rejects.toThrow(
        "Email zayd@example.com is already in use by active contact c-active-conflict",
      );
    });

    it("traps PostgreSQL 23505 unique violation error during save and throws ConflictError (409)", async () => {
      const repo = createFakeContactsRepo();
      vi.mocked(repo.findById).mockResolvedValue({
        id: "c-archived",
        firstName: "Zayd",
        lastName: "Ali",
        email: "zayd@example.com",
        deletedAt: "2026-05-01T00:00:00.000Z",
      } as any);

      vi.mocked(repo.findActiveContactsMatchingUniqueValues).mockResolvedValue([]);
      const pgError = new Error("duplicate key value violates unique constraint");
      (pgError as any).code = "23505";
      vi.mocked(repo.save).mockRejectedValue(pgError);

      await expect(
        runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
      ).rejects.toThrow(ConflictError);

      await expect(
        runWithTenant("demo", () => restoreContactById("c-archived", "u-admin", repo)),
      ).rejects.toThrow(
        "Cannot restore contact: active record with this unique identifier already exists",
      );
    });

    it("traps PostgreSQL 23505 unique violation error during bulkSave and throws ConflictError (409)", async () => {
      const repo = createFakeContactsRepo();
      vi.mocked(repo.findByIds).mockResolvedValue([
        {
          id: "c-archived",
          firstName: "Zayd",
          lastName: "Ali",
          email: "zayd@example.com",
          deletedAt: "2026-05-01T00:00:00.000Z",
        } as any,
      ]);

      vi.mocked(repo.findActiveContactsMatchingUniqueValues).mockResolvedValue([]);
      const pgError = new Error("duplicate key value violates unique constraint");
      (pgError as any).code = "23505";
      vi.mocked(repo.bulkSave).mockRejectedValue(pgError);

      await expect(
        runWithTenant("demo", () => bulkRestoreContacts(["c-archived"], "u-admin", repo)),
      ).rejects.toThrow(ConflictError);

      await expect(
        runWithTenant("demo", () => bulkRestoreContacts(["c-archived"], "u-admin", repo)),
      ).rejects.toThrow(
        "Cannot restore contact: active record with this unique identifier already exists",
      );
    });
  });

  describe("3. Restrict Guard (Default Referential Integrity)", () => {
    it("throws ValidationError (400) when archiving invoice with active payments", async () => {
      const fakeTx = {
        $count: vi.fn().mockResolvedValue(2),
        update: vi.fn(),
      };

      vi.mocked(withTenant).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      await expect(bulkSoftDeleteInvoices("demo", ["inv-1"])).rejects.toThrow(ValidationError);

      await expect(bulkSoftDeleteInvoices("demo", ["inv-1"])).rejects.toThrow(
        "Cannot archive invoice with active payments (2 active payment(s) exist)",
      );
    });

    it("throws ValidationError (400) when archiving account with active journal lines", async () => {
      const fakeTx = {
        $count: vi.fn().mockResolvedValue(5),
        update: vi.fn(),
      };

      vi.mocked(withTenant).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      await expect(bulkSoftDeleteAccounts("demo", ["acc-1"])).rejects.toThrow(ValidationError);

      await expect(bulkSoftDeleteAccounts("demo", ["acc-1"])).rejects.toThrow(
        "Cannot archive account with active journal lines (5 active line(s) exist)",
      );
    });
  });

  describe("4. Programmatic Atomic Cascade & Row Lock (Sessions & Enrollments)", () => {
    it("softDeleteSessionWithCascade locks parent row FOR UPDATE and sets deletedWithCascade: true on enrollments", async () => {
      const selectForUpdateSpy = vi.fn().mockResolvedValue([{ id: "sess-1" }]);
      const updateReturningSpy = vi.fn().mockResolvedValue([{ id: "sess-1" }]);
      const enrollmentsUpdateSpy = vi.fn().mockResolvedValue([]);

      const fakeTx = {
        // Enrolled-session sync (enrollmentSessionSync) runs raw SQL in the same transaction.
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: selectForUpdateSpy,
            })),
          })),
        })),
        update: vi.fn(() => {
          return {
            set: vi.fn((data: any) => ({
              where: vi.fn(() => {
                if (data.deletedWithCascade === true) {
                  return enrollmentsUpdateSpy();
                }
                return {
                  returning: updateReturningSpy,
                };
              }),
            })),
          };
        }),
      };

      vi.mocked(withTenant).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      const ok = await softDeleteSessionWithCascade("demo", "sess-1", "u-admin", "Cancelled");

      expect(ok).toBe(true);
      expect(selectForUpdateSpy).toHaveBeenCalledWith("update");
      expect(updateReturningSpy).toHaveBeenCalled();
      expect(enrollmentsUpdateSpy).toHaveBeenCalled();
    });

    it("restoreSessionWithCascade only restores enrollments that were deleted with cascade", async () => {
      let sessionRestored = false;
      let enrollmentsRestored = false;

      const fakeTx = {
        // Enrolled-session sync (enrollmentSessionSync) runs raw SQL in the same transaction.
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn().mockResolvedValue([{ id: "sess-1" }]),
            })),
          })),
        })),
        update: vi.fn(() => {
          return {
            set: vi.fn((data: any) => ({
              where: vi.fn(() => {
                if (data.deletedWithCascade === false) {
                  enrollmentsRestored = true;
                  return Promise.resolve([]);
                }
                sessionRestored = true;
                return {
                  returning: vi.fn().mockResolvedValue([{ id: "sess-1" }]),
                };
              }),
            })),
          };
        }),
      };

      vi.mocked(withTenant).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      const ok = await restoreSessionWithCascade("demo", "sess-1", "u-admin");

      expect(ok).toBe(true);
      expect(sessionRestored).toBe(true);
      expect(enrollmentsRestored).toBe(true);
    });

    it("archiving a session cascades deletedWithCascade: true to its enrollments, and independent archived enrollments remain deleted when restored", async () => {
      const mockSessions = [
        {
          id: "sess-1",
          workspaceSubdomain: "demo",
          deletedAt: null as Date | null,
          deletedWithCascade: false,
        },
      ];
      const mockEnrollments = [
        {
          id: "enr-independent",
          sessionId: "sess-1",
          workspaceSubdomain: "demo",
          deletedAt: new Date("2026-04-01T00:00:00.000Z") as Date | null,
          deletedWithCascade: false,
        },
        {
          id: "enr-active",
          sessionId: "sess-1",
          workspaceSubdomain: "demo",
          deletedAt: null as Date | null,
          deletedWithCascade: false,
        },
      ];

      const fakeTx = {
        // Enrolled-session sync (enrollmentSessionSync) runs raw SQL in the same transaction.
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn().mockResolvedValue([{ id: "sess-1" }]),
            })),
          })),
        })),
        update: vi.fn((_table: any) => ({
          set: vi.fn((setData: any) => ({
            where: vi.fn((_condition: any) => {
              if (setData.deletedWithCascade === true) {
                mockEnrollments.forEach((e) => {
                  if (e.sessionId === "sess-1" && e.deletedAt === null) {
                    e.deletedAt = setData.deletedAt;
                    e.deletedWithCascade = true;
                  }
                });
                return Promise.resolve([]);
              } else if (setData.deletedWithCascade === false) {
                mockEnrollments.forEach((e) => {
                  if (e.sessionId === "sess-1" && e.deletedWithCascade === true) {
                    e.deletedAt = null;
                    e.deletedWithCascade = false;
                  }
                });
                return Promise.resolve([]);
              } else if (setData.deletedAt === null) {
                const s = mockSessions.find((item) => item.id === "sess-1");
                if (s && s.deletedAt !== null) {
                  s.deletedAt = null;
                  return {
                    returning: vi.fn().mockResolvedValue([{ id: "sess-1" }]),
                  };
                }
                return { returning: vi.fn().mockResolvedValue([]) };
              } else {
                const s = mockSessions.find((item) => item.id === "sess-1");
                if (s && s.deletedAt === null) {
                  s.deletedAt = setData.deletedAt;
                  return {
                    returning: vi.fn().mockResolvedValue([{ id: "sess-1" }]),
                  };
                }
                return { returning: vi.fn().mockResolvedValue([]) };
              }
            }),
          })),
        })),
      };

      vi.mocked(withTenant).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      // 1. Archive the session
      const deleteOk = await softDeleteSessionWithCascade("demo", "sess-1", "u-admin");
      expect(deleteOk).toBe(true);

      // Verify parent session is soft-deleted
      expect(mockSessions[0].deletedAt).not.toBeNull();

      // Verify active enrollment was soft-deleted with deletedWithCascade: true
      const enrActive = mockEnrollments.find((e) => e.id === "enr-active")!;
      expect(enrActive.deletedAt).not.toBeNull();
      expect(enrActive.deletedWithCascade).toBe(true);

      // Verify independent enrollment remained deleted with deletedWithCascade: false
      const enrIndep = mockEnrollments.find((e) => e.id === "enr-independent")!;
      expect(enrIndep.deletedAt).toEqual(new Date("2026-04-01T00:00:00.000Z"));
      expect(enrIndep.deletedWithCascade).toBe(false);

      // 2. Restore the session
      const restoreOk = await restoreSessionWithCascade("demo", "sess-1", "u-admin");
      expect(restoreOk).toBe(true);

      // Verify parent session is restored
      expect(mockSessions[0].deletedAt).toBeNull();

      // Verify previously active enrollment was restored
      expect(enrActive.deletedAt).toBeNull();
      expect(enrActive.deletedWithCascade).toBe(false);

      // CRITICAL: Verify independent enrollment REMAINS deleted
      expect(enrIndep.deletedAt).toEqual(new Date("2026-04-01T00:00:00.000Z"));
      expect(enrIndep.deletedWithCascade).toBe(false);
    });
  });

  describe("5. Atomic Latch & 404 Disambiguation (genericRelationalService)", () => {
    interface TestItem {
      id: string;
      name: string;
      deletedAt?: string | null;
      deletedBy?: string | null;
      deletionReason?: string | null;
    }

    const testItemSchema = z.object({
      id: z.string(),
      name: z.string(),
      deletedAt: z.string().nullable().optional(),
      deletedBy: z.string().nullable().optional(),
      deletionReason: z.string().nullable().optional(),
    });

    it("deleteById returns true on successful atomic latch", async () => {
      const repo = {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
        deleteById: vi.fn().mockResolvedValue(true),
      };

      const service = createGenericRelationalService<TestItem>({
        repo,
        schema: testItemSchema,
        websocketCollection: "test_items",
        idPrefix: "item",
      });

      const ok = await runWithTenant("demo", () => service.deleteById("item-1", "u-admin"));
      expect(ok).toBe(true);
      expect(repo.deleteById).toHaveBeenCalledWith("demo", "item-1", "u-admin", undefined);
    });

    it('deleteById throws NotFoundError ("item is already archived") when latch updates 0 rows and row is soft-deleted', async () => {
      const repo = {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue({
          id: "item-1",
          name: "Archived Item",
          deletedAt: "2026-06-01T00:00:00.000Z",
        }),
        save: vi.fn().mockResolvedValue(undefined),
        deleteById: vi.fn().mockResolvedValue(false),
      };

      const service = createGenericRelationalService<TestItem>({
        repo,
        schema: testItemSchema,
        websocketCollection: "test_items",
        idPrefix: "item",
      });

      await expect(
        runWithTenant("demo", () => service.deleteById("item-1", "u-admin")),
      ).rejects.toThrow(new NotFoundError("item is already archived"));
    });

    it('deleteById throws NotFoundError ("item not found") when latch updates 0 rows and row does not exist', async () => {
      const repo = {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
        deleteById: vi.fn().mockResolvedValue(false),
      };

      const service = createGenericRelationalService<TestItem>({
        repo,
        schema: testItemSchema,
        websocketCollection: "test_items",
        idPrefix: "item",
      });

      await expect(
        runWithTenant("demo", () => service.deleteById("item-nonexistent", "u-admin")),
      ).rejects.toThrow(new NotFoundError("item not found"));
    });

    it('restoreById throws NotFoundError ("item is already active") when latch updates 0 rows and row is not soft-deleted', async () => {
      const repo = {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue({
          id: "item-1",
          name: "Active Item",
          deletedAt: null,
        }),
        save: vi.fn().mockResolvedValue(undefined),
        restoreById: vi.fn().mockResolvedValue(false),
      };

      const service = createGenericRelationalService<TestItem>({
        repo,
        schema: testItemSchema,
        websocketCollection: "test_items",
        idPrefix: "item",
      });

      await expect(runWithTenant("demo", () => service.restoreById("item-1"))).rejects.toThrow(
        new NotFoundError("item is already active"),
      );
    });

    it('restoreById throws NotFoundError ("item not found") when latch updates 0 rows and row does not exist', async () => {
      const repo = {
        listByWorkspace: vi.fn().mockResolvedValue([]),
        findById: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
        restoreById: vi.fn().mockResolvedValue(false),
      };

      const service = createGenericRelationalService<TestItem>({
        repo,
        schema: testItemSchema,
        websocketCollection: "test_items",
        idPrefix: "item",
      });

      await expect(
        runWithTenant("demo", () => service.restoreById("item-nonexistent")),
      ).rejects.toThrow(new NotFoundError("item not found"));
    });
  });

  describe("6. AST Predicate Construction (buildTenantSoftDeleteConditions)", () => {
    const fakeTable = {
      workspaceSubdomain: "subdomain_col",
      deletedAt: "deleted_at_col",
    } as unknown as TenantSoftDeleteTable;

    it("constructs Category B partial index predicate for active records", () => {
      const conditions = buildTenantSoftDeleteConditions(fakeTable, "Demo", "active");
      expect(conditions).toHaveLength(2);
    });

    it("constructs Category C partial index predicate for deleted records", () => {
      const conditions = buildTenantSoftDeleteConditions(fakeTable, "Demo", "deleted");
      expect(conditions).toHaveLength(2);
    });

    it("constructs workspaceSubdomain only for all filter", () => {
      const conditions = buildTenantSoftDeleteConditions(fakeTable, "Demo", "all");
      expect(conditions).toHaveLength(1);
    });
  });

  describe("7. Active Foreign Key Guarding (Dangling Reference Prevention)", () => {
    const fakeRepo: EnrollmentsRepository = {
      countEnrollmentsActive: vi.fn().mockResolvedValue(0),
      listEnrollmentsByWorkspace: vi.fn().mockResolvedValue([]),
      listEnrollmentsPage: vi
        .fn()
        .mockResolvedValue({ enrollments: [], total: 0, page: 1, limit: 12, hasMore: false }),
      findEnrollmentById: vi.fn().mockResolvedValue(null),
      findEnrollmentsByIds: vi.fn().mockResolvedValue([]),
      saveEnrollment: vi.fn().mockResolvedValue(undefined),
      bulkSoftDeleteEnrollments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
      bulkRestoreEnrollments: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
      aggregateEnrollmentsCommandMetrics: vi.fn().mockResolvedValue({} as any),
      aggregateEnrollmentsWidgetQueries: vi.fn().mockResolvedValue({}),
      loadEnrollmentsReportAggregates: vi.fn().mockResolvedValue({} as any),
    };

    it("createEnrollment throws 400 when studentId references an archived student", async () => {
      const useCases = createEnrollmentsUseCases(fakeRepo, {
        findStudentById: vi.fn().mockResolvedValue({
          id: "st-archived",
          deletedAt: "2026-01-01T00:00:00.000Z",
        }),
        findSessionById: vi.fn().mockResolvedValue({
          id: "sess-active",
          deletedAt: null,
        }),
      });

      await expect(
        runWithTenant("demo", () =>
          useCases.createEnrollment({
            id: "enr-1",
            studentId: "st-archived",
            sessionId: "sess-active",
            classId: "cls-1",
            status: "enrolled",
            enrolledAt: "2026-01-01",
          } as any),
        ),
      ).rejects.toThrow("Referenced student is archived or does not exist");
    });

    it("createEnrollment throws 400 when sessionId references an archived session", async () => {
      const useCases = createEnrollmentsUseCases(fakeRepo, {
        findStudentById: vi.fn().mockResolvedValue({
          id: "st-active",
          deletedAt: null,
        }),
        findSessionById: vi.fn().mockResolvedValue({
          id: "sess-archived",
          deletedAt: "2026-01-01T00:00:00.000Z",
        }),
      });

      await expect(
        runWithTenant("demo", () =>
          useCases.createEnrollment({
            id: "enr-1",
            studentId: "st-active",
            sessionId: "sess-archived",
            classId: "cls-1",
            status: "enrolled",
            enrolledAt: "2026-01-01",
          } as any),
        ),
      ).rejects.toThrow("Referenced session is archived or does not exist");
    });
  });

  describe("8. Faculty Uniqueness-on-Restore & 23505 Trap (restoreFacultyById)", () => {
    it("throws ConflictError (409) when an active faculty member already owns the same employeeId", async () => {
      const fakeRepo = {
        findById: vi.fn().mockResolvedValue({
          id: "t-archived",
          employeeId: "EMP-001",
          deletedAt: "2026-05-01T00:00:00.000Z",
        }),
        findRegistrationConflict: vi.fn().mockResolvedValue("employeeId"),
        save: vi.fn().mockResolvedValue(undefined),
      } as unknown as FacultyRepository;

      await expect(
        runWithTenant("demo", () => restoreFacultyById("t-archived", "u-admin", fakeRepo)),
      ).rejects.toThrow(ConflictError);

      await expect(
        runWithTenant("demo", () => restoreFacultyById("t-archived", "u-admin", fakeRepo)),
      ).rejects.toThrow("Employee ID EMP-001 is already in use by another active faculty");
    });

    it("traps PostgreSQL 23505 unique violation error during save and throws ConflictError (409)", async () => {
      const pgError = Object.assign(new Error("duplicate key value"), { code: "23505" });
      const fakeRepo = {
        findById: vi.fn().mockResolvedValue({
          id: "t-archived",
          employeeId: "EMP-001",
          deletedAt: "2026-05-01T00:00:00.000Z",
        }),
        findRegistrationConflict: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockRejectedValue(pgError),
      } as unknown as FacultyRepository;

      await expect(
        runWithTenant("demo", () => restoreFacultyById("t-archived", "u-admin", fakeRepo)),
      ).rejects.toThrow(ConflictError);

      await expect(
        runWithTenant("demo", () => restoreFacultyById("t-archived", "u-admin", fakeRepo)),
      ).rejects.toThrow(
        "Cannot restore faculty: active record with this unique identifier already exists",
      );
    });

    it("traps PostgreSQL 23505 unique violation error during bulkSave and throws ConflictError (409)", async () => {
      const pgError = Object.assign(new Error("duplicate key value"), { code: "23505" });
      const fakeRepo = {
        findByIds: vi.fn().mockResolvedValue([
          {
            id: "t-archived",
            employeeId: "EMP-001",
            deletedAt: "2026-05-01T00:00:00.000Z",
          },
        ]),
        bulkSave: vi.fn().mockRejectedValue(pgError),
      } as unknown as FacultyRepository;

      await expect(
        runWithTenant("demo", () => bulkRestoreFaculty(["t-archived"], "u-admin", fakeRepo)),
      ).rejects.toThrow(ConflictError);

      await expect(
        runWithTenant("demo", () => bulkRestoreFaculty(["t-archived"], "u-admin", fakeRepo)),
      ).rejects.toThrow(
        "Cannot restore faculty: active record with this unique identifier already exists",
      );
    });
  });

  describe("9. Student Uniqueness-on-Restore 23505 Trap (restoreStudentById)", () => {
    it("traps PostgreSQL 23505 unique violation error during save and throws StudentRestoreConflictError", async () => {
      const pgError = Object.assign(new Error("duplicate key value"), { code: "23505" });
      const fakeRepo = {
        findById: vi.fn().mockResolvedValue({
          id: "st-archived",
          grNumber: "GR-100",
          deletedAt: "2026-05-01T00:00:00.000Z",
        }),
        findRegistrationConflict: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockRejectedValue(pgError),
      } as unknown as StudentsRepository;

      await expect(
        runWithTenant("demo", () => restoreStudentById("st-archived", "u-admin", fakeRepo)),
      ).rejects.toThrow(StudentRestoreConflictError);
    });

    it("traps PostgreSQL 23505 unique violation error during bulkSave and throws StudentRestoreConflictError", async () => {
      const pgError = Object.assign(new Error("duplicate key value"), { code: "23505" });
      const fakeRepo = {
        findByIds: vi.fn().mockResolvedValue([
          {
            id: "st-archived",
            grNumber: "GR-100",
            deletedAt: "2026-05-01T00:00:00.000Z",
          },
        ]),
        findActiveGrNumberOwners: vi.fn().mockResolvedValue(new Map()),
        bulkSave: vi.fn().mockRejectedValue(pgError),
      } as unknown as StudentsRepository;

      await expect(
        runWithTenant("demo", () => bulkRestoreStudents(["st-archived"], "u-admin", fakeRepo)),
      ).rejects.toThrow(StudentRestoreConflictError);
    });
  });

  describe("10. Deprecated in-memory filtering (filterInMemorySoftDeleted)", () => {
    it("filters active, deleted, and all records in memory", () => {
      const items = [
        { id: "1", deletedAt: null },
        { id: "2", deletedAt: "2026-01-01" },
      ];
      expect(filterInMemorySoftDeleted(items, "active")).toEqual([{ id: "1", deletedAt: null }]);
      expect(filterInMemorySoftDeleted(items, "deleted")).toEqual([
        { id: "2", deletedAt: "2026-01-01" },
      ]);
      expect(filterInMemorySoftDeleted(items, "all")).toEqual(items);
    });
  });

  describe("11. Multi-ID SQL AST Soft-Delete Filtering (No In-Memory Leaks)", () => {
    it("findInvoicesByIds builds SQL conditions with isNull(deletedAt) unless includeDeleted is true", async () => {
      const fakeTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([])),
          })),
        })),
      };
      vi.mocked(withTenantRead).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      await findInvoicesByIds("demo", ["inv-1"]);
      expect(fakeTx.select).toHaveBeenCalled();

      await findInvoicesByIds("demo", ["inv-1"], { includeDeleted: true });
      expect(fakeTx.select).toHaveBeenCalledTimes(2);
    });

    it("findPaymentsByIds builds SQL conditions with isNull(deletedAt) unless includeDeleted is true", async () => {
      const fakeTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([])),
          })),
        })),
      };
      vi.mocked(withTenantRead).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      await findPaymentsByIds("demo", ["pay-1"]);
      expect(fakeTx.select).toHaveBeenCalled();

      await findPaymentsByIds("demo", ["pay-1"], { includeDeleted: true });
      expect(fakeTx.select).toHaveBeenCalledTimes(2);
    });

    it("findEnrollmentsByIds builds SQL conditions with isNull(deletedAt) unless includeDeleted is true", async () => {
      const fakeTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([])),
          })),
        })),
      };
      vi.mocked(withTenantRead).mockImplementation(async (_subdomain, cb) => cb(fakeTx as any));

      await findEnrollmentsByIds("demo", ["enr-1"]);
      expect(fakeTx.select).toHaveBeenCalled();

      await findEnrollmentsByIds("demo", ["enr-1"], { includeDeleted: true });
      expect(fakeTx.select).toHaveBeenCalledTimes(2);
    });

    it("financeUseCases.getInvoicesByIds passes includeDeleted: false to repository", async () => {
      const fakeRepo = {
        findInvoicesByIds: vi.fn().mockResolvedValue([]),
      };
      const cases = createFinanceUseCases(fakeRepo as any);
      await runWithTenant("demo", () => cases.getInvoicesByIds(["inv-1", "inv-2"]));
      expect(fakeRepo.findInvoicesByIds).toHaveBeenCalledWith("demo", ["inv-1", "inv-2"], {
        includeDeleted: false,
      });
    });

    it("financeUseCases.getPaymentsByIds passes includeDeleted: false to repository", async () => {
      const fakeRepo = {
        findPaymentsByIds: vi.fn().mockResolvedValue([]),
      };
      const cases = createFinanceUseCases(fakeRepo as any);
      await runWithTenant("demo", () => cases.getPaymentsByIds(["pay-1", "pay-2"]));
      expect(fakeRepo.findPaymentsByIds).toHaveBeenCalledWith("demo", ["pay-1", "pay-2"], {
        includeDeleted: false,
      });
    });

    it("enrollmentsUseCases.loadEnrollmentsByIds forwards includeDeleted option to repository", async () => {
      const fakeRepo = {
        findEnrollmentsByIds: vi.fn().mockResolvedValue([]),
      };
      const cases = createEnrollmentsUseCases(fakeRepo as any);
      await runWithTenant("demo", () =>
        cases.loadEnrollmentsByIds(["enr-1"], { includeDeleted: true }),
      );
      expect(fakeRepo.findEnrollmentsByIds).toHaveBeenCalledWith("demo", ["enr-1"], {
        includeDeleted: true,
      });
    });
  });

  describe("12. Active Foreign Key Guarding (Attendance & Sessions)", () => {
    it("createAttendanceRecord throws 400 when student is archived", async () => {
      const cases = createAttendanceUseCases({} as any, {
        findStudentById: vi.fn().mockResolvedValue({ id: "st-1", deletedAt: "2026-01-01" }),
        findSessionById: vi.fn().mockResolvedValue({ id: "sess-1", deletedAt: null }),
      });
      await expect(
        runWithTenant("demo", () =>
          cases.createAttendanceRecord({
            id: "att-1",
            studentId: "st-1",
            classId: "sess-1",
            date: "2026-05-01",
            status: "present",
          } as any),
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("student is archived"),
      });
    });

    it("createAttendanceRecord throws 400 when student does not exist", async () => {
      const cases = createAttendanceUseCases({} as any, {
        findStudentById: vi.fn().mockResolvedValue(null),
        findSessionById: vi.fn().mockResolvedValue({ id: "sess-1", deletedAt: null }),
      });
      await expect(
        runWithTenant("demo", () =>
          cases.createAttendanceRecord({
            id: "att-1",
            studentId: "st-missing",
            classId: "sess-1",
            date: "2026-05-01",
            status: "present",
          } as any),
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("student is archived or does not exist"),
      });
    });

    it("createAttendanceRecord throws 400 when the class session is archived", async () => {
      const cases = createAttendanceUseCases({} as any, {
        findStudentById: vi.fn().mockResolvedValue({ id: "st-1", deletedAt: null }),
        findSessionById: vi
          .fn()
          .mockResolvedValue({ id: "sess-archived", deletedAt: "2026-01-01" }),
      });
      await expect(
        runWithTenant("demo", () =>
          cases.createAttendanceRecord({
            id: "att-1",
            studentId: "st-1",
            classId: "sess-archived",
            date: "2026-05-01",
            status: "present",
          } as any),
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("class is archived"),
      });
    });

    it("upsertAttendanceRecords throws 400 when any student in batch is archived or missing", async () => {
      const cases = createAttendanceUseCases({ bulkSaveAttendanceRecords: vi.fn() } as any, {
        findStudentsByIds: vi.fn().mockResolvedValue([
          { id: "st-1", deletedAt: null },
          { id: "st-2", deletedAt: "2026-01-01" },
        ]),
        findSessionsByIds: vi.fn().mockResolvedValue([{ id: "sess-1", deletedAt: null }]),
      });
      await expect(
        runWithTenant("demo", () =>
          cases.upsertAttendanceRecords([
            {
              id: "att-1",
              studentId: "st-1",
              classId: "sess-1",
              date: "2026-05-01",
              status: "present",
            },
            {
              id: "att-2",
              studentId: "st-2",
              classId: "sess-1",
              date: "2026-05-01",
              status: "present",
            },
          ] as any),
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("student is archived or does not exist"),
      });
    });

    it("createSession throws 400 when class faculty is archived or does not exist", async () => {
      const cases = createSessionsUseCases({} as any, {
        findFacultyByIds: vi
          .fn()
          .mockResolvedValue([{ id: "teach-archived", deletedAt: "2026-01-01" }]),
      });
      await expect(
        runWithTenant("demo", () =>
          cases.createSession({
            id: "sess-new",
            name: "Morning Session",
            startDate: "2026-09-01",
            endDate: "2027-06-01",
            classes: [{ id: "cls-1", name: "Class A", facultyId: "teach-archived" }],
          } as any),
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("faculty is archived or does not exist"),
      });
    });

    it("updateSessionById throws 400 when class faculty does not exist", async () => {
      const cases = createSessionsUseCases({} as any, {
        findFacultyByIds: vi.fn().mockResolvedValue([]),
      });
      await expect(
        runWithTenant("demo", () =>
          cases.updateSessionById("sess-1", {
            id: "sess-1",
            name: "Updated Session",
            classes: [{ id: "cls-1", name: "Class A", facultyId: "teach-nonexistent" }],
          } as any),
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("faculty is archived or does not exist"),
      });
    });
  });
});
