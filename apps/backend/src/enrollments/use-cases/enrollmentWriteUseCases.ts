import {
  allowedEnrollmentTransitions,
  canTransitionEnrollment,
  isEnrollmentTerminal,
  parseEnrollmentStatus,
  type EnrollmentRecord,
  type EnrollmentUpdate,
  type EnrollmentInsert,
} from "@mms/shared";
import type { createGenericRelationalService } from "../../services/genericRelationalService.js";
import { withTenant } from "../../db/tenant-context.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { ConflictError, HttpDomainError, ValidationError } from "../../lib/httpErrors.js";
import {
  validateActiveForeignKeys,
  validateNewEnrollmentRules,
  withoutSoftDeleteFields,
} from "./enrollmentAdmissionRules.js";
import { changedEnrollmentFields, recordEnrollmentAudit } from "./enrollmentAudit.js";
import type { EnrollmentsRepository } from "../repository/enrollmentsRepository.js";
import type { EnrollmentsUseCasesDependencies } from "./enrollmentAdmissionRules.js";

/**
 * Enrollment write use cases (create/update/trash/restore). Split out of the composition root
 * to keep it inside the 300-line ceiling; every write commits with its immutable audit row in
 * the same transaction.
 */
export function createEnrollmentWriteUseCases({
  repo,
  crud,
  deps,
}: {
  repo: EnrollmentsRepository;
  crud: ReturnType<typeof createGenericRelationalService<EnrollmentRecord>>;
  deps?: EnrollmentsUseCasesDependencies;
}) {
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
      const created = await withTenant(tenant, async (tx) => {
        const row = await crud.create({ ...sanitized, status } as EnrollmentRecord);
        await recordEnrollmentAudit(tx, tenant, {
          recordId: row.id,
          actionType: "CREATE",
          reasonCode: "create",
          newState: {
            studentId: row.studentId,
            sessionId: row.sessionId,
            classId: row.classId,
            sectionId: row.sectionId ?? null,
            status: row.status,
            finalFee: row.finalFee,
          },
        });
        return row;
      });
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
      const existing = await repo.findEnrollmentById(tenant, id);
      if (!existing || existing.deletedAt) return null;

      const nextStatus =
        sanitized.status === undefined ? undefined : parseEnrollmentStatus(sanitized.status);
      const statusChanged = nextStatus !== undefined && nextStatus !== existing.status;
      if (
        statusChanged &&
        !canTransitionEnrollment(existing.status, nextStatus, { channel: "manual" })
      ) {
        throw new HttpDomainError(
          409,
          "invalid_status_transition",
          `Cannot change the status from "${existing.status}" to "${nextStatus}". ` +
            `Allowed here: ${allowedEnrollmentTransitions(existing.status, { channel: "manual" }).join(", ") || "none"}. ` +
            "Use the withdraw, cancel, readmission or session-completion action for the other outcomes.",
        );
      }
      const feeTouched = [
        "baseFee",
        "discountType",
        "discountLabel",
        "discountPct",
        "discountAmt",
        "finalFee",
      ].some((field) => (sanitized as Record<string, unknown>)[field] !== undefined);
      const reasonCode = statusChanged
        ? "status_change"
        : feeTouched
          ? "fee_adjustment"
          : sanitized.paymentStatus !== undefined
            ? "payment_status"
            : "details_edit";

      // The status predicate runs in the same transaction as the record write and the audit,
      // so a concurrent operation that moved the row first wins with a 409 and the trail
      // always matches the committed record.
      return withTenant(tenant, async (tx) => {
        if (statusChanged) {
          if (!repo.transitionEnrollmentStatusTx) {
            throw new Error("Enrollment repository cannot guard status transitions");
          }
          await repo.transitionEnrollmentStatusTx(tx, tenant.trim().toLowerCase(), {
            id,
            from: existing.status,
            to: nextStatus,
          });
        }
        const updated = await crud.updateById(id, sanitized);
        if (!updated) return null;
        const diff = changedEnrollmentFields(
          existing as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>,
          [
            "status",
            "paymentStatus",
            "baseFee",
            "discountType",
            "discountLabel",
            "discountPct",
            "discountAmt",
            "finalFee",
            "classId",
            "sectionId",
          ],
        );
        await recordEnrollmentAudit(tx, tenant, {
          recordId: id,
          actionType: "UPDATE",
          reasonCode,
          oldState: diff.oldState,
          // Notes are free text: record that they changed, never their content.
          newState: {
            ...diff.newState,
            ...(existing.notes !== updated.notes ? { notesChanged: true } : {}),
          },
        });
        return updated;
      });
    },
    deleteEnrollmentById: async (id: string, deletedBy?: string, deletionReason?: string) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      const before = await repo.findEnrollmentById(tenant, id);
      return withTenant(tenant, async (tx) => {
        const deleted = await crud.deleteById(id, deletedBy ?? "system", deletionReason);
        if (deleted && before) {
          await recordEnrollmentAudit(tx, tenant, {
            recordId: id,
            actionType: "DELETE",
            reasonCode: "trash",
            oldState: {
              status: before.status,
              sessionId: before.sessionId,
              classId: before.classId,
              sectionId: before.sectionId ?? null,
            },
            newState: { deletionReason: deletionReason ?? null },
          });
        }
        return deleted;
      });
    },
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
      return withTenant(tenant, async (tx) => {
        const restored = await crud.restoreById(id, userId);
        if (restored) {
          await recordEnrollmentAudit(tx, tenant, {
            recordId: id,
            actionType: "RESTORE",
            reasonCode: "restore",
            oldState: { deletedAt: existing.deletedAt },
            newState: { status: existing.status },
          });
        }
        return restored;
      });
    },
    bulkRestoreEnrollments: async (ids: string[], userId?: string) => {
      const tenant = getRequestTenant();
      if (!tenant) throw new Error("Tenant context required");
      return withTenant(tenant, async (tx) => {
        const result = await crud.bulkRestoreByIds(ids, userId);
        if (result.succeeded > 0) {
          for (const id of ids) {
            await recordEnrollmentAudit(tx, tenant, {
              recordId: id,
              actionType: "RESTORE",
              reasonCode: "restore",
            });
          }
        }
        return result;
      });
    },
  };
}
