import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { SEAT_RELEASED_ENROLLMENT_STATUSES, type Enrollment } from "@mms/shared";
import { enrollments } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { ConflictError } from "../../lib/httpErrors.js";
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
  if (constraint === LIVE_STUDENT_SESSION_UIDX)
    return new ConflictError("This student already has an active enrollment in this session");
  if (constraint === SECTION_ROLL_NO_UIDX)
    return new ConflictError("This roll number is already used in the section");
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
