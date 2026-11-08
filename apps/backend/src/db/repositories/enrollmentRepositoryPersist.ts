import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { OPEN_INVOICE_STATUSES, dedupeTrimmedIds, type Enrollment } from "@mms/shared";
import { enrollments, enrollmentTimelineEvents, financeInvoices } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { recordToInsert } from "./enrollmentRecordToInsert.js";
import { resolveEnrollmentSectionsTx } from "./enrollmentSectionResolve.js";

import { syncEnrolledSessionsTx } from "./enrollmentSessionSync.js";
import { appendClientTimelineTx, syncPlacementsTx } from "./enrollmentHistoryWrite.js";
import { findWorkspaceTimezone } from "./workspaceRepository.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { enableIncludeDeleted } from "../../lib/softDeleteHelpers.js";
import { enrollmentWriteConflict, findLiveEnrollmentPairsTx } from "./enrollmentWriteGuards.js";
import { ConflictError } from "../../lib/httpErrors.js";

export {
  enrollmentWriteConflict,
  transitionEnrollmentStatusTx,
  linkEnrollmentInvoiceIds,
} from "./enrollmentWriteGuards.js";

async function workspaceToday(subdomain: string): Promise<string> {
  return todayInTimeZone(await findWorkspaceTimezone(subdomain));
}

export async function saveEnrollment(tenant: string, record: Enrollment): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceToday(subdomain);
  try {
    await withTenant(subdomain, async (tx) => {
      const [placed] = await resolveEnrollmentSectionsTx(tx, subdomain, [record]);
      const values = recordToInsert(subdomain, placed);
      await tx
        .insert(enrollments)
        .values(values)
        .onConflictDoUpdate({
          target: [enrollments.workspaceSubdomain, enrollments.id],
          set: {
            studentId: values.studentId,
            studentName: values.studentName,
            sessionId: values.sessionId,
            sessionName: values.sessionName,
            classId: values.classId,
            className: values.className,
            sectionId: values.sectionId,
            rollNo: values.rollNo,
            enrolledDate: values.enrolledDate,
            startOn: values.startOn,
            baseFee: values.baseFee,
            discountType: values.discountType,
            discountLabel: values.discountLabel,
            discountPct: values.discountPct,
            discountAmt: values.discountAmt,
            finalFee: values.finalFee,
            status: values.status,
            invoiceId: values.invoiceId,
            paymentStatus: values.paymentStatus,
            notes: values.notes,
            deletedAt: values.deletedAt,
            deletedBy: values.deletedBy,
            deletionReason: values.deletionReason,
            restoredAt: values.restoredAt,
            restoredBy: values.restoredBy,
            deletedWithCascade: values.deletedWithCascade,
            updatedAt: new Date(),
          },
        });

      await appendClientTimelineTx(tx, subdomain, [record]);
      await syncPlacementsTx(tx, subdomain, [placed], today);
      await syncEnrolledSessionsTx(tx, subdomain, { studentIds: [String(placed.studentId)] });
    });
  } catch (error) {
    throw enrollmentWriteConflict(error) ?? error;
  }
}

/**
 * Bulk enrollment write. Returns the ids that were actually written: a live (student,
 * session) pair that another row already holds is skipped instead of failing the whole
 * batch, and a concurrent duplicate that slips past the pre-check is reported as a
 * domain conflict.
 */
export async function bulkSaveEnrollments(
  tenant: string,
  records: Enrollment[],
): Promise<{ inserted: string[] }> {
  if (records.length === 0) return { inserted: [] };
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceToday(subdomain);
  try {
    return await withTenant(subdomain, async (tx) => {
      const placed = await resolveEnrollmentSectionsTx(tx, subdomain, records);
      const owners = await findLiveEnrollmentPairsTx(tx, subdomain, placed);
      const toWrite = placed.filter((record) => {
        const owner = owners.get(`${record.sessionId}|${record.studentId}`);
        // The pair this record itself already occupies is an update, not a duplicate.
        return !owner || owner === String(record.id);
      });
      if (toWrite.length > 0) {
        await tx
          .insert(enrollments)
          .values(toWrite.map((record) => recordToInsert(subdomain, record)))
          .onConflictDoUpdate({
            target: [enrollments.workspaceSubdomain, enrollments.id],
            set: {
              studentId: sql`excluded.student_id`,
              studentName: sql`excluded.student_name`,
              sessionId: sql`excluded.session_id`,
              sessionName: sql`excluded.session_name`,
              classId: sql`excluded.class_id`,
              className: sql`excluded.class_name`,
              sectionId: sql`excluded.section_id`,
              rollNo: sql`excluded.roll_no`,
              enrolledDate: sql`excluded.enrolled_on`,
              startOn: sql`excluded.start_on`,
              baseFee: sql`excluded.base_fee`,
              discountType: sql`excluded.discount_type`,
              discountLabel: sql`excluded.discount_label`,
              discountPct: sql`excluded.discount_pct`,
              discountAmt: sql`excluded.discount_amt`,
              finalFee: sql`excluded.final_fee`,
              status: sql`excluded.status`,
              invoiceId: sql`excluded.invoice_id`,
              paymentStatus: sql`excluded.payment_status`,
              notes: sql`excluded.notes`,
              deletedAt: sql`excluded.deleted_at`,
              deletedBy: sql`excluded.deleted_by`,
              deletionReason: sql`excluded.deletion_reason`,
              restoredAt: sql`excluded.restored_at`,
              restoredBy: sql`excluded.restored_by`,
              deletedWithCascade: sql`excluded.deleted_with_cascade`,
              updatedAt: new Date(),
            },
          });
      }

      if (toWrite.length > 0) {
        await appendClientTimelineTx(tx, subdomain, toWrite);
        await syncPlacementsTx(tx, subdomain, toWrite, today);
        await syncEnrolledSessionsTx(tx, subdomain, {
          studentIds: toWrite.map((record) => String(record.studentId)),
        });
      }
      return { inserted: toWrite.map((record) => String(record.id)) };
    });
  } catch (error) {
    throw enrollmentWriteConflict(error) ?? error;
  }
}

export async function replaceEnrollmentsForWorkspace(
  tenant: string,
  records: Enrollment[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  const today = await workspaceToday(subdomain);
  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(enrollmentTimelineEvents)
      .where(eq(enrollmentTimelineEvents.workspaceSubdomain, subdomain));
    await tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, subdomain));
    if (records.length > 0) {
      const placed = await resolveEnrollmentSectionsTx(tx, subdomain, records);
      await tx
        .insert(enrollments)
        .values(placed.map((record) => recordToInsert(subdomain, record)));
      await appendClientTimelineTx(tx, subdomain, records);
      await syncPlacementsTx(tx, subdomain, placed, today);
      // A restore replaces the whole table: legacy class-less pairs for students who now have
      // enrollments must be consumed here too, or membership would keep a phantom session.
      await syncEnrolledSessionsTx(tx, subdomain, {
        enrollmentIds: placed.map((record) => record.id),
      });
    }
  });
}

export async function bulkSoftDeleteEnrollments(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    // Trashing an enrollment frees its seat but is not a withdrawal: it settles nothing.
    // Block it while the enrollment still has open invoices so a student never disappears
    // from the roster while remaining billable (use the withdrawal path to settle).
    const openInvoices = await tx
      .select({ enrollmentId: financeInvoices.enrollmentId })
      .from(financeInvoices)
      .where(
        and(
          eq(financeInvoices.workspaceSubdomain, subdomain),
          inArray(financeInvoices.enrollmentId, uniqueIds),
          isNull(financeInvoices.deletedAt),
          inArray(financeInvoices.status, [...OPEN_INVOICE_STATUSES]),
        ),
      )
      .limit(1);
    if (openInvoices.length > 0) {
      throw new ConflictError(
        "This enrollment still has open invoices — settle or cancel them first, or withdraw the enrollment instead of deleting it",
      );
    }
    // PostgreSQL re-checks the UPDATE's new row against the policy's USING expression,
    // and `deleted_at` is part of it: without this opt-in the soft-delete is rejected
    // as an RLS violation under the production (non-bypass) role.
    await enableIncludeDeleted(tx);
    const updated = await tx
      .update(enrollments)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        deletedWithCascade: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          inArray(enrollments.id, uniqueIds),
          isNull(enrollments.deletedAt),
        ),
      )
      .returning({ id: enrollments.id });

    await syncEnrolledSessionsTx(tx, subdomain, { enrollmentIds: updated.map((row) => row.id) });
    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreEnrollments(
  tenant: string,
  ids: string[],
  userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    // Archived rows are hidden by `tenant_soft_delete_isolation` (FORCE RLS) unless the
    // transaction opts in; without this the UPDATE silently matched zero rows.
    await enableIncludeDeleted(tx);
    const updated = await tx
      .update(enrollments)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        deletedWithCascade: false,
        restoredAt: now,
        restoredBy: userId || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(enrollments.workspaceSubdomain, subdomain),
          inArray(enrollments.id, uniqueIds),
          isNotNull(enrollments.deletedAt),
          // Same rule as the single restore: a row archived with its parent is restored
          // by restoring the parent, never on its own.
          eq(enrollments.deletedWithCascade, false),
          // A student may have been re-enrolled while this row sat in the trash; restoring
          // it would violate the live (student, session) unique index.
          sql`NOT EXISTS (
            SELECT 1 FROM enrollments live
             WHERE live.workspace_subdomain = ${enrollments.workspaceSubdomain}
               AND live.student_id = ${enrollments.studentId}
               AND live.session_id = ${enrollments.sessionId}
               AND live.id <> ${enrollments.id}
               AND live.deleted_at IS NULL
               AND live.status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
          )`,
        ),
      )
      .returning({ id: enrollments.id });

    await syncEnrolledSessionsTx(tx, subdomain, { enrollmentIds: updated.map((row) => row.id) });
    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
