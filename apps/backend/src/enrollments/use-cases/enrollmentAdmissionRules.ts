import { ENROLLMENT_ERROR_CODES } from "@mms/contracts";
import {
  addDeadlineError,
  enrollmentFeeForClass,
  isSessionReadOnly,
  staffEligibilityReasons,
  type EnrollmentRecord,
} from "@mms/contracts";
import { HttpDomainError, ValidationError } from "../../lib/httpErrors.js";
import { todayInTimeZone } from "../../lib/dbDate.js";
import { enrollmentsRepository } from "../repository/enrollmentsRepositoryAdapter.js";

/**
 * Admission rules and client-input sanitization for the enrollments create/update use cases.
 *
 * Split out of the composition root so it stays inside the 300-line ceiling; the rules
 * themselves are pure decisions (which write paths call them is the use case's job).
 */

/** A session class's discount shape, as consumed by {@link enrollmentFeeForClass}. */
export type EnrollmentClassDiscountInput = {
  discountType: string;
  percentage: number | string;
  status?: string;
};

export interface EnrollmentsUseCasesDependencies {
  findStudentById?: (
    tenant: string,
    id: string,
  ) => Promise<{
    id: string;
    deletedAt?: unknown;
    dob?: string | null;
    gender?: string | null;
    /** Student discount inputs for the authoritative fee rule (`enrollmentFeeForClass`). */
    discountType?: string | null;
    discountPct?: number | null;
  } | null>;
  findSessionById?: (
    tenant: string,
    id: string,
  ) => Promise<{
    id: string;
    deletedAt?: unknown;
    status?: string;
    startDate?: string | null;
    /** Session base fee (decimal string or number) for the authoritative fee rule. */
    baseFee?: number | string | null;
    classes?: Array<{
      id: string;
      name?: string;
      gender?: string | null;
      minAge?: number | null;
      maxAge?: number | null;
      ageCalculationDate?: string | null;
      enrollmentDeadline?: string;
      dropDeadline?: string;
      discounts?: EnrollmentClassDiscountInput[];
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
    throw new HttpDomainError(409, ENROLLMENT_ERROR_CODES[3], deadlineError.key, {
      details: { day: deadlineError.day },
    });
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
    throw new HttpDomainError(422, "ineligible", "enrollments.errors.ineligible", {
      details: { reasons },
    });
  }
}

/**
 * Authoritative enrollment fee for a student in a class (session base fee + class discounts).
 *
 * Mirrors the bulk/import/rollover/transfer write paths (`enrollmentFeeForClass`). The single
 * create endpoint must not trust client-supplied money fields, so it recomputes from the
 * schedule unless the caller holds the administrative `enrollments.manage` capability.
 */
export function recomputeEnrollmentFee(
  session:
    | {
        baseFee?: number | string | null;
        classes?: Array<{ id: string; discounts?: EnrollmentClassDiscountInput[] }>;
      }
    | null
    | undefined,
  classId: string | undefined,
  student: { discountType?: string | null; discountPct?: number | null } | null | undefined,
): ReturnType<typeof enrollmentFeeForClass> | null {
  if (!session || !classId) return null;
  const cls = session.classes?.find((candidate) => candidate.id === classId);
  if (!cls) return null;
  return enrollmentFeeForClass(session.baseFee ?? 0, cls, student ?? {});
}

/**
 * Validates that an enrollment's parent session and student are not archived prior to restore.
 */
export async function validateEnrollmentRestorePreconditions(
  tenant: string,
  existing: Pick<EnrollmentRecord, "sessionId" | "studentId">,
  deps?: EnrollmentsUseCasesDependencies,
): Promise<void> {
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
}
