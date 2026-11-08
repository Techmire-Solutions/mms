import type { EnrollmentsRepository } from "../repository/enrollmentsRepository.js";
import { enrollmentsRepository } from "../repository/enrollmentsRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { ConflictError, HttpDomainError, ValidationError } from "../../lib/httpErrors.js";
import { withTenant } from "../../db/tenant-context.js";
import { offerFreedSeatPostCommit } from "./admissionsWaitlistUseCases.js";
import {
  validateActiveForeignKeys,
  validateNewEnrollmentRules,
  withoutSoftDeleteFields,
  type EnrollmentsUseCasesDependencies,
} from "./enrollmentAdmissionRules.js";

export type { EnrollmentsUseCasesDependencies } from "./enrollmentAdmissionRules.js";
import {
  allowedEnrollmentTransitions,
  canTransitionEnrollment,
  isEnrollmentTerminal,
  parseEnrollmentStatus,
} from "@mms/shared";
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
        const before = await repo.findEnrollmentsByIds(tenant, ids);
        if (!repo.bulkSoftDeleteEnrollments) return { succeeded: 0, failed: ids.length };
        const result = await repo.bulkSoftDeleteEnrollments(tenant, ids, deletedBy, deletionReason);
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
    createEnrollment: async (record: EnrollmentInsert | EnrollmentRecord) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");

      // Active Foreign Key Guarding (§1.8)
      await validateActiveForeignKeys(tenant, record, deps);
      await validateNewEnrollmentRules(tenant, record as Partial<EnrollmentRecord>, deps);

      // Soft-delete provenance is server-owned (`mms-soft-delete` §5): a client must not
      // be able to create a hidden row, clear a deletion reason, or flip the cascade flag.
      const sanitized = withoutSoftDeleteFields(record as EnrollmentRecord);
      const id = String(sanitized.id ?? "").trim();
      if (id) {
        const existing = await repo.findEnrollmentById(tenant, id, { includeDeleted: true });
        if (existing?.deletedAt) {
          // Re-POSTing an archived id used to resurrect it through the upsert with no
          // `restored_at`/`restored_by`, bypassing the trash rules.
          throw new ConflictError(
            "An archived enrollment already uses this id; restore it instead of re-creating it",
          );
        }
      }

      // A new enrollment starts pending (or already confirmed); terminal states are
      // produced by the operation that owns them, never by a create payload.
      const status =
        sanitized.status === undefined ? "pending" : parseEnrollmentStatus(sanitized.status);
      if (isEnrollmentTerminal(status)) {
        throw new ValidationError(`An enrollment cannot be created as "${status}"`);
      }
      const created = await crud.create({ ...sanitized, status } as EnrollmentRecord);
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
      await validateActiveForeignKeys(tenant, record, deps);

      // A PUT may edit the enrollment; it may not edit its deletion lifecycle.
      const sanitized = withoutSoftDeleteFields(record as EnrollmentRecord);
      if (sanitized.status === undefined) return crud.updateById(id, sanitized);

      const existing = await repo.findEnrollmentById(tenant, id);
      if (!existing || existing.deletedAt) return null;
      const nextStatus = parseEnrollmentStatus(sanitized.status);
      if (nextStatus === existing.status) return crud.updateById(id, sanitized);
      if (!canTransitionEnrollment(existing.status, nextStatus, { channel: "manual" })) {
        throw new HttpDomainError(
          409,
          "invalid_status_transition",
          `Cannot change the status from "${existing.status}" to "${nextStatus}". ` +
            `Allowed here: ${allowedEnrollmentTransitions(existing.status, { channel: "manual" }).join(", ") || "none"}. ` +
            "Use the withdraw, cancel, readmission or session-completion action for the other outcomes.",
        );
      }

      // The status predicate runs in the same transaction as the rest of the record write,
      // so a concurrent operation that moved the row first wins with a 409.
      return withTenant(tenant, async (tx) => {
        if (!repo.transitionEnrollmentStatusTx) {
          throw new Error("Enrollment repository cannot guard status transitions");
        }
        // The nested repository calls join this transaction, so the guard and the rest
        // of the record write commit or roll back together.
        await repo.transitionEnrollmentStatusTx(tx, tenant.trim().toLowerCase(), {
          id,
          from: existing.status,
          to: nextStatus,
        });
        return crud.updateById(id, sanitized);
      });
    },
    deleteEnrollmentById: crud.deleteById,
    restoreEnrollmentById: async (id: string, userId?: string) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      // Archived rows are invisible under FORCE RLS unless the read opts in.
      const existing = await repo.findEnrollmentById(tenant, id, { includeDeleted: true });
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
      if (existing.studentId) {
        const getStudent =
          deps?.findStudentById ??
          (await import("../../db/repositories/studentRepositoryHydrate.js")).findStudentById;
        const student = await getStudent(tenant, existing.studentId);
        if (student?.deletedAt) {
          const err = new Error(
            "Cannot restore enrollment because its student is archived. Restore the student instead.",
          );
          (err as Error & { statusCode: number }).statusCode = 400;
          throw err;
        }
      }
      if (existing.sessionId && existing.studentId && repo.findActiveEnrollmentInSession) {
        // The student may have been re-enrolled while this row sat in the trash; restoring
        // it would create a second live enrollment for the same session.
        const active = await repo.findActiveEnrollmentInSession(
          tenant,
          existing.sessionId,
          existing.studentId,
        );
        if (active && String(active.id) !== String(id)) {
          throw new ConflictError(
            "This student is already actively enrolled in this session; cancel that enrollment before restoring this one",
          );
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
