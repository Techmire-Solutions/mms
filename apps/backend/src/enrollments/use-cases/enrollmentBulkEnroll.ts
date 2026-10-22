import { randomUUID } from "node:crypto";
import {
  enrollmentFeeForClass,
  todayISO,
  type Enrollment,
  type StudentsBulkEnrollBody,
} from "@mms/shared";
import { admissionsRepository as repo } from "../repository/admissionsRepositoryAdapter.js";
import { NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";

export type BulkEnrollInput = Omit<StudentsBulkEnrollBody, "studentIds"> & { studentIds: string[] };

/**
 * Bulk enrollment through `enrollments` (the source of truth):
 * - `add` creates pending enrollments in the class (section resolved server-side) with the shared
 *   fee rule; students already actively enrolled in the session are skipped (counted as failed);
 * - `remove` cancels the students' active enrollments in the session (history kept).
 * Membership (`student_session_memberships`) follows automatically (enrollmentSessionSync).
 */
export async function bulkEnrollStudentsIntoClass(
  tenant: string,
  input: BulkEnrollInput,
): Promise<{ succeeded: number; failed: number }> {
  const studentIds = [...new Set(input.studentIds.map((id) => String(id).trim()).filter(Boolean))];
  if (studentIds.length === 0) return { succeeded: 0, failed: 0 };

  if (input.mode === "remove") {
    const cancelled = await repo.cancelStudentEnrollmentsInSession(
      tenant,
      input.sessionId,
      studentIds,
    );
    await afterChange(tenant);
    return { succeeded: cancelled, failed: studentIds.length - cancelled };
  }

  const session = await repo.findSessionById(tenant, input.sessionId);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  const sessionClass = session.classes.find((cls) => cls.id === input.classId);
  if (!sessionClass) throw new ValidationError("Class does not belong to the selected session");

  const [students, already] = await Promise.all([
    repo.findStudentsByIds(tenant, studentIds),
    repo.findActivelyEnrolledStudentIds(tenant, session.id, studentIds),
  ]);
  const enrolledDate = todayISO();

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

  await repo.bulkSaveEnrollments(tenant, records);
  await afterChange(tenant);
  return { succeeded: records.length, failed: studentIds.length - records.length };
}

async function afterChange(tenant: string): Promise<void> {
  await invalidateMultiTierCache({ tenantId: tenant, domain: "students" });
  await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
  await broadcastCollection("enrollments");
  await broadcastCollection("students");
  await broadcastCollection("sessions");
}
