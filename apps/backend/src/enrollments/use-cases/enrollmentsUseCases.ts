import type { EnrollmentsRepository } from "../repository/enrollmentsRepository.js";
import { enrollmentsRepository } from "../repository/enrollmentsRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import {
  enrollmentRecordSchema,
  type EnrollmentRecord,
  type EnrollmentInsert,
  type EnrollmentUpdate,
  dedupeTrimmedIds,
  EMPTY_ENROLLMENTS_REPORT_AGGREGATES,
  normalizeEnrollmentsReportComparisonQuery,
  type EnrollmentsListQuery,
  type EnrollmentsCommandMetricsSnapshot,
  type EnrollmentsReportAggregates,
  type EnrollmentsReportComparisonQuery,
  type EnrollmentsWidgetQuery,
} from "@mms/shared";

export interface EnrollmentsUseCasesDependencies {
  findStudentById?: (
    tenant: string,
    id: string,
  ) => Promise<{ id: string; deletedAt?: unknown } | null>;
  findSessionById?: (
    tenant: string,
    id: string,
  ) => Promise<{ id: string; deletedAt?: unknown } | null>;
}

/**
 * Enrollments use-cases — composition root binding an {@link EnrollmentsRepository}
 * to every operation. Production uses the default Drizzle-backed
 * `enrollmentsUseCases`; tests can pass a fake repository to exercise
 * orchestration in isolation.
 */
export function createEnrollmentsUseCases(
  repo: EnrollmentsRepository = enrollmentsRepository,
  deps?: EnrollmentsUseCasesDependencies,
) {
  const crud = createGenericRelationalService<EnrollmentRecord>({
    repo: {
      listByWorkspace: repo.listEnrollmentsByWorkspace,
      findById: repo.findEnrollmentById,
      save: repo.saveEnrollment,
      bulkDelete: repo.bulkSoftDeleteEnrollments,
      bulkRestore: repo.bulkRestoreEnrollments,
    },
    schema: enrollmentRecordSchema,
    websocketCollection: "enrollments",
    idPrefix: "enr",
  });

  const validateActiveForeignKeys = async (tenant: string, record: Partial<EnrollmentRecord>) => {
    if (record.studentId) {
      const getStudent =
        deps?.findStudentById ??
        (await import("../../db/repositories/studentRepositoryHydrate.js")).findStudentById;
      const student = await getStudent(tenant, record.studentId);
      if (!student || student.deletedAt) {
        const err = new Error("Referenced student is archived or does not exist");
        (err as Error & { statusCode: number }).statusCode = 400;
        throw err;
      }
    }

    if (record.sessionId) {
      const getSession =
        deps?.findSessionById ??
        (await import("../../db/repositories/sessionRepositoryHydrate.js")).findSessionById;
      const session = await getSession(tenant, record.sessionId);
      if (!session || session.deletedAt) {
        const err = new Error("Referenced session is archived or does not exist");
        (err as Error & { statusCode: number }).statusCode = 400;
        throw err;
      }
    }
  };

  return {
    createEnrollment: async (record: EnrollmentInsert | EnrollmentRecord) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");

      // Active Foreign Key Guarding (§1.8)
      await validateActiveForeignKeys(tenant, record);

      const created = await crud.create(record as EnrollmentRecord);
      const { maybeGenerateInvoiceForEnrollment } =
        await import("../../finance/use-cases/financeInvoiceGenerationUseCases.js");
      return maybeGenerateInvoiceForEnrollment(created);
    },
    updateEnrollmentById: async (
      id: string,
      record: EnrollmentUpdate | Partial<EnrollmentRecord>,
    ) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");

      // Active Foreign Key Guarding (§1.8)
      await validateActiveForeignKeys(tenant, record);

      return crud.updateById(id, record as EnrollmentRecord);
    },
    deleteEnrollmentById: crud.deleteById,
    restoreEnrollmentById: async (id: string, userId?: string) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const existing = await repo.findEnrollmentById(tenant, id);
      if (!existing || !existing.deletedAt) return false;
      if (existing.deletedWithCascade) {
        const err = new Error(
          "Cannot restore enrollment archived with its session. Restore the parent session instead.",
        );
        (err as Error & { statusCode: number }).statusCode = 400;
        throw err;
      }
      if (existing.sessionId) {
        const getSession =
          deps?.findSessionById ??
          (await import("../../db/repositories/sessionRepositoryHydrate.js")).findSessionById;
        const session = await getSession(tenant, existing.sessionId);
        if (session?.deletedAt) {
          const err = new Error(
            "Cannot restore enrollment because its session is archived. Restore the session instead.",
          );
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
      }
      return crud.restoreById(id, userId);
    },
    bulkSoftDeleteEnrollments: crud.bulkDeleteByIds,
    bulkRestoreEnrollments: (ids: string[], userId?: string) => crud.bulkRestoreByIds(ids, userId),

    loadEnrollmentsPage: async (query: EnrollmentsListQuery & { includeDeleted?: boolean }) => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          enrollments: [],
          total: 0,
          page: query.page ?? 1,
          limit: query.limit ?? 12,
          hasMore: false,
        };
      }
      return repo.listEnrollmentsPage(tenant, query);
    },

    loadEnrollmentsByIds: async (
      ids: string[],
      options: boolean | { includeDeleted?: boolean } = false,
    ): Promise<EnrollmentRecord[]> => {
      const tenant = getRequestTenant();
      if (!tenant || ids.length === 0) return [];
      const cleanIds = dedupeTrimmedIds(ids);
      if (cleanIds.length === 0) return [];
      const includeDeleted =
        typeof options === "boolean" ? options : (options?.includeDeleted ?? false);
      return repo.findEnrollmentsByIds(tenant, cleanIds, { includeDeleted });
    },

    loadEnrollmentById: async (
      id: string,
      includeDeleted = false,
    ): Promise<EnrollmentRecord | null> => {
      const tenant = getRequestTenant();
      if (!tenant || !id.trim()) return null;
      const enrollment = await repo.findEnrollmentById(tenant, id.trim());
      if (!enrollment) return null;
      if (!includeDeleted && enrollment.deletedAt) return null;
      return enrollment;
    },

    countEnrollments: async (): Promise<number> => {
      const tenant = getRequestTenant();
      if (!tenant) return 0;
      return repo.countEnrollmentsActive(tenant);
    },

    loadEnrollmentsCommandMetrics: async (): Promise<EnrollmentsCommandMetricsSnapshot> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return {
          total: 0,
          confirmed: 0,
          pending: 0,
          cancelled: 0,
          completed: 0,
          revenue: 0,
          newThisPeriod: 0,
        };
      }
      return repo.aggregateEnrollmentsCommandMetrics(tenant);
    },

    loadEnrollmentsWidgetAggregates: async (
      queries: EnrollmentsWidgetQuery[],
      _request?: unknown,
    ): Promise<Record<string, import("@mms/shared").EnrollmentsWidgetAggregateResult>> => {
      const tenant = getRequestTenant();
      if (!tenant) return {};
      return repo.aggregateEnrollmentsWidgetQueries(tenant, queries);
    },

    loadEnrollmentsReportAggregates: async (
      comparisonQuery?: EnrollmentsReportComparisonQuery,
    ): Promise<EnrollmentsReportAggregates> => {
      const tenant = getRequestTenant();
      if (!tenant) {
        return EMPTY_ENROLLMENTS_REPORT_AGGREGATES;
      }
      const normalized = normalizeEnrollmentsReportComparisonQuery(comparisonQuery);
      return repo.loadEnrollmentsReportAggregates(tenant, normalized);
    },
  };
}

export const enrollmentsUseCases = createEnrollmentsUseCases();
