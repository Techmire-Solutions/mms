import { randomUUID } from "node:crypto";
import {
  addDeadlineError,
  describeEligibilityReasons,
  enrollmentFeeForClass,
  isSessionReadOnly,
  staffEligibilityReasons,
  type Enrollment,
  type StudentsBulkEnrollBody,
} from "@mms/shared";
import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import {
  ConflictError,
  HttpDomainError,
  NotFoundError,
  SeatCapacityError,
  ValidationError,
} from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { endLiveEnrollments } from "./enrollmentEndUseCases.js";
import { assertNoStudentScheduleCollision } from "./enrollmentTimetableGuard.js";
import { releaseOffersIfClassFullPostCommit } from "./admissionsWaitlistExpiry.js";
import { withTenant } from "../../db/tenant-context.js";
import { recordEnrollmentAudit } from "./enrollmentAudit.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { hasActiveTransaction } from "../../db/dbTransactions.js";
import { withSavepoint } from "../../db/transactionSideEffects.js";

export type BulkEnrollInput = Omit<StudentsBulkEnrollBody, "studentIds"> & { studentIds: string[] };

/**
 * Bulk enrollment through `enrollments` (the source of truth):
 * - `add` creates pending enrollments in the class (section resolved server-side) with the shared
 *   fee rule; students already actively enrolled in the session are skipped (counted as failed);
 * - `remove` cancels the students' operable enrollments in the session through the shared
 *   end path (window end, placement close, invoice settlement; history kept).
 * Membership (`student_session_memberships`) follows automatically (enrollmentSessionSync).
 */
export async function bulkEnrollStudentsIntoClass(
  tenant: string,
  input: BulkEnrollInput,
): Promise<{ succeeded: number; failed: number }> {
  const studentIds = [...new Set(input.studentIds.map((id) => String(id).trim()).filter(Boolean))];
  if (studentIds.length === 0) return { succeeded: 0, failed: 0 };

  if (input.mode === "remove") {
    // Same side effects as a staff cancellation: window end, placement close, invoice
    // settlement. The previous path only flipped the status, leaving the placement open
    // and later invoices billable for a student who had been removed.
    const outcome = await endLiveEnrollments(
      tenant,
      { sessionIds: [input.sessionId], studentIds },
      {
        status: "cancelled",
        lastDay: todayInTimeZone(await repo.findWorkspaceTimezone(tenant)),
        reason: "Removed from the class",
        actor: { userId: null, label: "Bulk remove" },
      },
    );
    return { succeeded: outcome.ended, failed: studentIds.length - outcome.ended };
  }

  const session = await repo.findSessionById(tenant, input.sessionId);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  // Staff may prepare a draft/open/in_progress roster; only a terminal session is read-only.
  if (isSessionReadOnly(session.status)) {
    throw new ConflictError(
      `This session is "${session.status}" and no longer accepts enrollments`,
    );
  }
  const sessionClass = session.classes.find((cls) => cls.id === input.classId);
  if (!sessionClass) throw new ValidationError("Class does not belong to the selected session");
  const today = todayInTimeZone(await repo.findWorkspaceTimezone(tenant));
  const deadlineError = addDeadlineError(sessionClass.enrollmentDeadline, today);
  if (deadlineError && !input.allowAfterDeadline) throw new ConflictError(deadlineError);

  const [students, already] = await Promise.all([
    repo.findStudentsByIds(tenant, studentIds),
    repo.findActivelyEnrolledStudentIds(tenant, session.id, studentIds),
  ]);
  const enrolledDate = today;
  const ineligible = students
    .map((student) => ({
      student,
      reasons: staffEligibilityReasons({
        student: { dob: student.dob ?? null, gender: student.gender ?? null },
        cls: {
          gender: sessionClass.gender,
          minAge: sessionClass.minAge,
          maxAge: sessionClass.maxAge,
          ageCalculationDate: sessionClass.ageCalculationDate,
        },
        session: { status: session.status, startDate: session.startDate },
        asOf: today,
      }),
    }))
    .filter((row) => row.reasons.length > 0);
  if (ineligible.length > 0 && !input.ignoreEligibility) {
    const [first] = ineligible;
    throw new HttpDomainError(
      422,
      "ineligible",
      `${first.student.name || String(first.student.id)} is not eligible for ${sessionClass.name}: ${describeEligibilityReasons(first.reasons)}`,
    );
  }

  const eligible = students
    .filter((student) => !student.deletedAt && !already.has(String(student.id)))
    .map((student) => String(student.id));
  await assertNoStudentScheduleCollision(tenant, session, sessionClass.id, eligible);

  const records: Enrollment[] = students
    .filter((student) => !student.deletedAt && !already.has(String(student.id)))
    .map((student) => {
      const fee = enrollmentFeeForClass(session.baseFee, sessionClass, student);
      return {
        id: `enr-${randomUUID()}`,
        studentId: String(student.id),
        studentName: student.name || "",
        sessionId: session.id,
        sessionName: session.name,
        classId: sessionClass.id,
        className: sessionClass.name,
        ...(input.sectionId ? { sectionId: input.sectionId } : {}),
        enrolledDate,
        ...fee,
        status: "pending",
        invoiceId: null,
        paymentStatus: "none",
        notes: "",
      } as Enrollment;
    });

  let inserted: string[];
  try {
    inserted = await withTenant(tenant, async (tx) => {
      const result = await repo.bulkSaveEnrollments(tenant, records);
      await auditCreatedEnrollments(tx, tenant, records, result.inserted, input);
      return result.inserted;
    });
  } catch (error) {
    // A full section or a concurrent duplicate rejects the whole batch before anything
    // is written; retry one row at a time so the rest of the roster still lands.
    if (!isRowRejection(error)) throw error;
    inserted = await saveIndividually(tenant, records, input);
  }
  if (inserted.length > 0) {
    // The batch can take the last free seat; an offer for this class is then stale.
    await releaseOffersIfClassFullPostCommit(tenant, sessionClass.id);
  }
  await afterChange(tenant);
  return { succeeded: inserted.length, failed: studentIds.length - inserted.length };
}

/** A per-record rejection (no seat left / already enrolled), not an infrastructure failure. */
function isRowRejection(error: unknown): boolean {
  return error instanceof SeatCapacityError || error instanceof ConflictError;
}

async function saveIndividually(
  tenant: string,
  records: readonly Enrollment[],
  input: StudentsBulkEnrollBody,
): Promise<string[]> {
  const inserted: string[] = [];
  for (const record of records) {
    const attempt = () =>
      withTenant(tenant, async (tx) => {
        const result = await repo.bulkSaveEnrollments(tenant, [record]);
        await auditCreatedEnrollments(tx, tenant, [record], result.inserted, input);
        return result.inserted;
      });
    try {
      // Inside an ambient transaction (e.g. admissions approval) a rejected row must not
      // poison the outer transaction, so each attempt gets its own savepoint.
      const ids = hasActiveTransaction() ? await withSavepoint(() => attempt()) : await attempt();
      inserted.push(...ids);
    } catch (error) {
      if (!isRowRejection(error)) throw error;
    }
  }
  return inserted;
}

/** One immutable CREATE row per enrollment, inside the inserting transaction. */
async function auditCreatedEnrollments(
  tx: Parameters<typeof recordEnrollmentAudit>[0],
  tenant: string,
  records: readonly Enrollment[],
  insertedIds: readonly string[],
  input: StudentsBulkEnrollBody,
): Promise<void> {
  const inserted = new Set(insertedIds);
  for (const record of records) {
    if (!inserted.has(record.id)) continue;
    await recordEnrollmentAudit(tx, tenant, {
      recordId: record.id,
      actionType: "CREATE",
      reasonCode: "bulk_enroll",
      newState: {
        studentId: record.studentId,
        sessionId: record.sessionId,
        classId: record.classId,
        sectionId: record.sectionId ?? null,
        status: record.status,
        finalFee: record.finalFee,
        ...(input.allowAfterDeadline ? { overrideAfterDeadline: true } : {}),
        ...(input.ignoreEligibility ? { overrideEligibility: true } : {}),
      },
    });
  }
}

async function afterChange(tenant: string): Promise<void> {
  await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
  await broadcastCollection("enrollments");
  await broadcastCollection("students");
  await broadcastCollection("sessions");
}
