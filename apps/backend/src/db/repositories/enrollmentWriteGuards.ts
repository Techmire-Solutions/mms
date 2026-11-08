import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES, type Enrollment } from "@mms/shared";
import { enrollments } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import {
  AlreadyEnrolledError,
  ConflictError,
  RollNumberConflictError,
} from "../../lib/httpErrors.js";
import { isUniqueViolation, uniqueViolationConstraint } from "../../lib/pgErrors.js";

/**
 * Write-path guards shared by the enrollment persistence functions.
 *
 * Split out of `enrollmentRepositoryPersist.ts` to stay inside the 300-line ceiling and
 * because the unique-index → domain-error mapping is the contract the bulk path and the
 * route layer both rely on.
 */

const LIVE_STUDENT_SESSION_UIDX = "enrollments_live_student_session_uidx";
const SECTION_ROLL_NO_UIDX = "enrollments_section_roll_no_active_uidx";

/** Turns the two unique-index backstops into the domain conflict they represent. */
export function enrollmentWriteConflict(error: unknown): Error | null {
  if (!isUniqueViolation(error)) return null;
  const constraint = uniqueViolationConstraint(error);
  if (constraint === LIVE_STUDENT_SESSION_UIDX) return new AlreadyEnrolledError();
  if (constraint === SECTION_ROLL_NO_UIDX) return new RollNumberConflictError();
  return null;
}

/**
 * Live enrollments that already hold a (student, session) pair covered by `records`.
 *
 * The batch fast path for bulk writes: those rows are skipped instead of letting the
 * unique index abort the whole transaction. The index remains the authority for the
 * race the pre-check cannot see.
 */
export async function findLiveEnrollmentPairsTx(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly Enrollment[],
): Promise<Map<string, string>> {
  const sessionIds = [...new Set(records.map((record) => String(record.sessionId)))];
  const studentIds = [...new Set(records.map((record) => String(record.studentId)))];
  if (sessionIds.length === 0 || studentIds.length === 0) return new Map();
  const rows = await tx
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      sessionId: enrollments.sessionId,
    })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        inArray(enrollments.sessionId, sessionIds),
        inArray(enrollments.studentId, studentIds),
        isNull(enrollments.deletedAt),
        notInArray(enrollments.status, [...SEAT_RELEASED_ENROLLMENT_STATUSES]),
      ),
    );
  return new Map(rows.map((row) => [`${row.sessionId}|${row.studentId}`, row.id]));
}

/**
 * Guarded status transition for the generic CRUD channel.
 *
 * The status predicate is inside the UPDATE, so a concurrent operation that already moved
 * the row (e.g. a cancellation) makes this a 409 instead of a silent regression. Callers
 * must run it in the same transaction as the rest of the record write.
 */
export async function transitionEnrollmentStatusTx(
  tx: TenantTransaction,
  subdomain: string,
  input: { id: string; from: string; to: string },
): Promise<void> {
  const changed = await tx
    .update(enrollments)
    .set({ status: input.to, updatedAt: new Date() })
    .where(
      and(
        eq(enrollments.workspaceSubdomain, subdomain),
        eq(enrollments.id, input.id),
        eq(enrollments.status, input.from),
        isNull(enrollments.deletedAt),
      ),
    )
    .returning({ id: enrollments.id });
  if (changed.length === 0) {
    throw new ConflictError(
      "This enrollment changed while the action was running — reload and try again",
    );
  }
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
        links.map(
          (link) => sql`WHEN ${enrollments.id} = ${link.enrollmentId} THEN ${link.invoiceId}`,
        ),
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
