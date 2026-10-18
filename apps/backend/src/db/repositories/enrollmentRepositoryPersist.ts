import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { dedupeTrimmedIds, type Enrollment, type EnrollmentTimelineItem } from '@mms/shared';
import { enrollments, enrollmentTimelineEvents } from '../schema.js';
import { withTenant, type TenantTransaction } from '../tenant-context.js';
import { recordToInsert } from './enrollmentRecordToInsert.js';
import { resolveEnrollmentSectionsTx } from './enrollmentSectionResolve.js';

import { syncEnrolledSessionsTx } from './enrollmentSessionSync.js';
async function writeTimelineEvents(
  tx: TenantTransaction,
  subdomain: string,
  enrollmentId: string,
  timeline: EnrollmentTimelineItem[] | undefined,
): Promise<void> {
  if (!timeline || timeline.length === 0) return;
  await tx
    .delete(enrollmentTimelineEvents)
    .where(
      and(
        eq(enrollmentTimelineEvents.workspaceSubdomain, subdomain),
        eq(enrollmentTimelineEvents.enrollmentId, enrollmentId),
      ),
    );

  await tx.insert(enrollmentTimelineEvents).values(
    timeline.map((item) => ({
      workspaceSubdomain: subdomain,
      enrollmentId,
      event: item.event,
      by: item.by,
      ts: item.ts,
    })),
  );
}

export async function saveEnrollment(
  tenant: string,
  record: Enrollment,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
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

    await writeTimelineEvents(tx, subdomain, record.id, record.timeline);
    await syncEnrolledSessionsTx(tx, subdomain, { studentIds: [String(placed.studentId)] });
  });
}

export async function bulkSaveEnrollments(
  tenant: string,
  records: Enrollment[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    const recordIds = records.map((r) => String(r.id));
    await tx
      .insert(enrollments)
      .values((await resolveEnrollmentSectionsTx(tx, subdomain, records)).map((record) => recordToInsert(subdomain, record)))
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
          enrolledDate: sql`excluded.enrolled_date`,
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


    await tx
      .delete(enrollmentTimelineEvents)
      .where(
        and(
          eq(enrollmentTimelineEvents.workspaceSubdomain, subdomain),
          inArray(enrollmentTimelineEvents.enrollmentId, recordIds),
        ),
      );

    const allEvents = records.flatMap((record) =>
      (record.timeline ?? []).map((item) => ({
        workspaceSubdomain: subdomain,
        enrollmentId: String(record.id),
        event: item.event,
        by: item.by,
        ts: item.ts,
      })),
    );
    if (allEvents.length > 0) {
      await tx.insert(enrollmentTimelineEvents).values(allEvents);
    }
    await syncEnrolledSessionsTx(tx, subdomain, { studentIds: records.map((record) => String(record.studentId)) });
  });
}

/** Sets `invoice_id` only when the enrollment does not already have one. */
export async function linkEnrollmentInvoiceIds(
  tenant: string,
  links: readonly { enrollmentId: string; invoiceId: string }[],
): Promise<void> {
  if (links.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.execute(sql`
      UPDATE ${enrollments}
      SET invoice_id = CASE ${sql.join(
        links.map((link) => sql`WHEN ${enrollments.id} = ${link.enrollmentId} THEN ${link.invoiceId}`),
        sql` `,
      )} END,
      updated_at = now()
      WHERE ${enrollments.workspaceSubdomain} = ${subdomain}
        AND ${enrollments.id} IN (${sql.join(
          links.map((link) => sql`${link.enrollmentId}`),
          sql`, `,
        )})
        AND ${enrollments.invoiceId} IS NULL
        AND ${enrollments.deletedAt} IS NULL
    `);
  });
}

export async function replaceEnrollmentsForWorkspace(
  tenant: string,
  records: Enrollment[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(enrollmentTimelineEvents).where(eq(enrollmentTimelineEvents.workspaceSubdomain, subdomain));
    await tx.delete(enrollments).where(eq(enrollments.workspaceSubdomain, subdomain));
    if (records.length > 0) {
      const placed = await resolveEnrollmentSectionsTx(tx, subdomain, records);
      await tx.insert(enrollments).values(placed.map((record) => recordToInsert(subdomain, record)));
      const allEvents = records.flatMap((record) =>
        (record.timeline ?? []).map((item) => ({
          workspaceSubdomain: subdomain,
          enrollmentId: record.id,
          event: item.event,
          by: item.by,
          ts: item.ts,
        })),
      );
      if (allEvents.length > 0) {
        await tx.insert(enrollmentTimelineEvents).values(allEvents);
      }
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

