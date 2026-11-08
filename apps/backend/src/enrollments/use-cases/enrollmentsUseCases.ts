import type { EnrollmentsRepository } from "../repository/enrollmentsRepository.js";
import { enrollmentsRepository } from "../repository/enrollmentsRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { withTenant } from "../../db/tenant-context.js";
import { recordEnrollmentAudit } from "./enrollmentAudit.js";
import { offerFreedSeatPostCommit } from "./admissionsWaitlistUseCases.js";
import type { EnrollmentsUseCasesDependencies } from "./enrollmentAdmissionRules.js";
import { createEnrollmentWriteUseCases } from "./enrollmentWriteUseCases.js";

export type { EnrollmentsUseCasesDependencies } from "./enrollmentAdmissionRules.js";
import {
  enrollmentRecordSchema,
  type EnrollmentRecord,
  dedupeTrimmedIds,
  EMPTY_ENROLLMENTS_REPORT_AGGREGATES,
  normalizeEnrollmentsReportComparisonQuery,
  type EnrollmentsListQuery,
  type EnrollmentsCommandMetricsSnapshot,
  type EnrollmentsReportAggregates,
  type EnrollmentsReportComparisonQuery,
  type EnrollmentsWidgetQuery,
} from "@mms/shared";

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
      // Trash frees seats: read the classes first, then offer each freed seat after the delete
      // commits (a waitlist failure must not turn a successful trash into an error).
      bulkDelete: async (
        tenant: string,
        ids: string[],
        deletedBy?: string,
        deletionReason?: string,
      ) => {
        if (!repo.bulkSoftDeleteEnrollments) return { succeeded: 0, failed: ids.length };
        const before = await repo.findEnrollmentsByIds(tenant, ids);
        // Trash + audit commit together: a failed audit rolls the archive back.
        const result = await withTenant(tenant, async (tx) => {
          const archived = await repo.bulkSoftDeleteEnrollments!(
            tenant,
            ids,
            deletedBy,
            deletionReason,
          );
          const kept = before.filter((record) => ids.includes(record.id));
          for (const record of kept) {
            await recordEnrollmentAudit(tx, tenant, {
              recordId: record.id,
              actionType: "DELETE",
              reasonCode: "trash",
              oldState: {
                status: record.status,
                sessionId: record.sessionId,
                classId: record.classId,
                sectionId: record.sectionId ?? null,
              },
              newState: { deletionReason: deletionReason ?? null },
            });
          }
          return archived;
        });
        if (result.succeeded > 0) {
          const classIds = [...new Set(before.map((record) => record.classId))];
          for (const classId of classIds) await offerFreedSeatPostCommit(tenant, classId);
        }
        return result;
      },
      bulkRestore: repo.bulkRestoreEnrollments,
    },
    schema: enrollmentRecordSchema,
    websocketCollection: "enrollments",
    idPrefix: "enr",
  });

  return {
    ...createEnrollmentWriteUseCases({ repo, crud, deps }),
    bulkSoftDeleteEnrollments: crud.bulkDeleteByIds,
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
      const enrollment = await repo.findEnrollmentById(tenant, id.trim(), { includeDeleted });
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
