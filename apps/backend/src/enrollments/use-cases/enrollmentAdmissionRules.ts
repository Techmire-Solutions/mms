import { ENROLLMENT_ERROR_CODES } from "@mms/shared";
import {
  addDeadlineError,
  describeEligibilityReasons,
  isSessionReadOnly,
  staffEligibilityReasons,
  type EnrollmentRecord,
} from "@mms/shared";
import { HttpDomainError, ValidationError } from "../../lib/httpErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { enrollmentsRepository } from "../repository/enrollmentsRepositoryAdapter.js";

/**
 * Admission rules and client-input sanitization for the enrollments create/update use cases.
 *
 * Split out of the composition root so it stays inside the 300-line ceiling; the rules
 * themselves are pure decisions (which write paths call them is the use case's job).
 */

export interface EnrollmentsUseCasesDependencies {
  findStudentById?: (
    tenant: string,
    id: string,
  ) => Promise<{
    id: string;
    deletedAt?: unknown;
    dob?: string | null;
    gender?: string | null;
  } | null>;
  findSessionById?: (
    tenant: string,
    id: string,
  ) => Promise<{
    id: string;
    deletedAt?: unknown;
    status?: string;
    startDate?: string | null;
    classes?: Array<{
      id: string;
      name?: string;
      gender?: string | null;
      minAge?: number | null;
      maxAge?: number | null;
      ageCalculationDate?: string | null;
      enrollmentDeadline?: string;
      dropDeadline?: string;
    }>;
  } | null>;
  findWorkspaceTimezone?: (tenant: string) => Promise<string | null>;
}

/** Deletion lifecycle columns a client may never set on an enrollment write. */
const SERVER_OWNED_SOFT_DELETE_FIELDS = [
  "deletedAt",
  "deletedBy",
  "deletionReason",
  "deletedWithCascade",
  "restoredAt",
  "restoredBy",
] as const;

export function withoutSoftDeleteFields<T>(record: T): T {
  const clean = { ...(record as Record<string, unknown>) };
  for (const field of SERVER_OWNED_SOFT_DELETE_FIELDS) delete clean[field];
  return clean as T;
}

export async function validateActiveForeignKeys(
  tenant: string,
  record: Partial<EnrollmentRecord>,
  deps?: EnrollmentsUseCasesDependencies,
): Promise<void> {
  if (record.studentId) {
    const getStudent = deps?.findStudentById ?? enrollmentsRepository.findStudentById;
    if (!getStudent) throw new Error("Student lookup unavailable");
    const student = await getStudent(tenant, record.studentId);
    if (!student || student.deletedAt) {
      const err = new Error("Referenced student is archived or does not exist");
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
  }

  if (record.sessionId) {
    const getSession = deps?.findSessionById ?? enrollmentsRepository.findSessionById;
    if (!getSession) throw new Error("Session lookup unavailable");
    const session = await getSession(tenant, record.sessionId);
    if (!session || session.deletedAt) {
      const err = new Error("Referenced session is archived or does not exist");
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
  }
}

/**
 * Admission rules for a *new* enrollment: session state, class add deadline and
 * age/gender eligibility. Updates deliberately skip these (editing notes after the
 * deadline must keep working). The generic create endpoint has no override flags —
 * imports go through the bulk path, which does.
 */
export async function validateNewEnrollmentRules(
  tenant: string,
  record: Partial<EnrollmentRecord>,
  deps?: EnrollmentsUseCasesDependencies,
): Promise<void> {
  if (!record.sessionId || !record.classId) return;
  const getSession = deps?.findSessionById ?? enrollmentsRepository.findSessionById;
  const getStudent = deps?.findStudentById ?? enrollmentsRepository.findStudentById;
  if (!getSession || !getStudent) throw new Error("Entity lookups unavailable");
  const [session, student] = await Promise.all([
    getSession(tenant, record.sessionId),
    record.studentId ? getStudent(tenant, record.studentId) : Promise.resolve(null),
  ]);
  // Injected test doubles are minimal; a real hydrated session always has classes.
  const classes = session?.classes;
  if (!session || !Array.isArray(classes)) return;
  if (isSessionReadOnly(String(session.status))) {
    throw new HttpDomainError(
      409,
      "session_not_enrollable",
      `This session is "${session.status}" and no longer accepts enrollments`,
    );
  }
  const cls = classes.find((candidate) => candidate.id === record.classId);
  if (!cls) throw new ValidationError("Class does not belong to the selected session");
  const getTimezone = deps?.findWorkspaceTimezone ?? enrollmentsRepository.findWorkspaceTimezone;
  const timezone = getTimezone ? await getTimezone(tenant) : "UTC";
  const today = todayInTimeZone(timezone);
  const deadlineError = addDeadlineError(cls.enrollmentDeadline, today);
  if (deadlineError) {
    throw new HttpDomainError(409, ENROLLMENT_ERROR_CODES[3], deadlineError);
  }
  if (!student) return;
  const reasons = staffEligibilityReasons({
    student: { dob: student.dob ?? null, gender: student.gender ?? null },
    cls: {
      gender: cls.gender,
      minAge: cls.minAge,
      maxAge: cls.maxAge,
      ageCalculationDate: cls.ageCalculationDate,
    },
    session: { status: String(session.status), startDate: session.startDate },
    asOf: today,
  });
  if (reasons.length > 0) {
    throw new HttpDomainError(
      422,
      "ineligible",
      `The student is not eligible for this class: ${describeEligibilityReasons(reasons)}`,
    );
  }
}
