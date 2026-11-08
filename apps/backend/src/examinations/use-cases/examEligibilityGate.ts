import type { ExamResult, User } from "@mms/shared";
import { examEligibilityRepository as repo } from "../repository/examEligibilityAdapter.js";
import { examinationsUseCases } from "./examinationsUseCases.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { HttpDomainError } from "../../lib/httpErrors.js";

/**
 * Exam eligibility gate for result entry.
 *
 * A student may not have a result recorded for an exam whose attendance threshold they miss, unless
 * an audited override exists. Runs in the bulk-save `beforeSave` hook, so it covers the only write
 * path results have.
 */

export interface BlockedStudent {
  studentId: string;
  attendancePct: number | null;
  requiredPct: number;
  state: string;
}

export async function assertExamResultsEligible(
  _user: User,
  results: readonly ExamResult[],
): Promise<void> {
  const tenant = getRequestTenant();
  if (!tenant || results.length === 0) return;

  const examIds = [...new Set(results.map((result) => result.examId).filter(Boolean))];
  const exams = await examinationsUseCases.loadExamsByIds(examIds);
  const examsById = new Map(exams.map((exam) => [exam.id, exam]));

  const blocked: BlockedStudent[] = [];
  const unknown: string[] = [];
  const notEnrolled: string[] = [];
  const overMarks: string[] = [];

  for (const examId of examIds) {
    const exam = examsById.get(examId);
    const rows = results.filter((result) => result.examId === examId);
    if (!exam) continue;

    // Marks sanity: the DB cannot compare against the exam's total, so the app must.
    for (const result of rows) {
      const marks = Number(result.marksObtained ?? 0);
      if (!Number.isFinite(marks) || marks < 0 || marks > exam.totalMarks) {
        overMarks.push(`${result.studentId} (${marks}/${exam.totalMarks})`);
      }
    }

    const classIds = await repo.findExamClassIds(tenant, examId);
    const enrolled = await repo.listEnrolledStudentIds(tenant, classIds);
    for (const result of rows) {
      if (!enrolled.has(result.studentId)) {
        notEnrolled.push(`${result.studentId} @ ${examId}`);
      }
    }

    const eligibility = await repo.loadExamEligibility(tenant, examId);
    if (eligibility.requiredPct === null) continue;

    const overrides = await repo.listActiveOverrides(
      tenant,
      [examId],
      rows.map((result) => result.studentId),
    );
    const byStudent = new Map(eligibility.rows.map((row) => [row.studentId, row]));
    for (const result of rows) {
      if (overrides.has(`${examId}|${result.studentId}`)) continue;
      const row = byStudent.get(result.studentId);
      if (!row) continue;
      if (row.state === "blocked") {
        blocked.push({
          studentId: result.studentId,
          attendancePct: row.attendancePct,
          requiredPct: row.requiredPct ?? eligibility.requiredPct,
          state: row.state,
        });
      } else if (row.state === "unknown") {
        unknown.push(`${result.studentId} @ ${examId}`);
      }
    }
  }

  if (overMarks.length > 0) {
    throw new HttpDomainError(
      400,
      "exam_marks_out_of_range",
      `Marks must be between 0 and the exam total: ${overMarks.slice(0, 5).join(", ")}`,
    );
  }
  if (notEnrolled.length > 0) {
    throw new HttpDomainError(
      409,
      "exam_student_not_enrolled",
      `These students are not enrolled in the exam's class: ${notEnrolled.slice(0, 5).join(", ")}`,
    );
  }
  if (unknown.length > 0) {
    throw new HttpDomainError(
      409,
      "exam_eligibility_unknown",
      `Attendance cannot be evaluated yet for: ${unknown.slice(0, 5).join(", ")}. Mark the roster or grant an override.`,
    );
  }
  if (blocked.length > 0) {
    const summary = blocked
      .slice(0, 5)
      .map((row) => `${row.studentId} ${row.attendancePct ?? "?"}% < ${row.requiredPct}%`)
      .join(", ");
    throw new HttpDomainError(
      409,
      "exam_eligibility_blocked",
      `Below the exam attendance threshold: ${summary}`,
    );
  }
}

/** Loads attendance eligibility view for all enrolled students in the exam's classes. */
export async function getExamEligibilityView(tenant: string, examId: string) {
  return repo.loadExamEligibility(tenant, examId);
}

/** Configures or removes the exam-level attendance threshold. */
export async function configureExamAttendanceGate(
  tenant: string,
  input: { examId: string; minAttendancePct: number | null; actorId: string },
) {
  return repo.setExamAttendanceGate(tenant, input);
}

/** Grants an audited eligibility override for a blocked student. */
export async function grantExamEligibilityOverride(
  tenant: string,
  input: { examId: string; studentId: string; reason: string; grantedBy: string },
) {
  return repo.grantEligibilityOverride(tenant, input);
}

/** Stamps results finalisation on the exam to unblock session completion. */
export async function updateExamResultsFinalized(
  tenant: string,
  input: { examId: string; finalized: boolean; actorId: string },
) {
  return repo.setExamResultsFinalized(tenant, input);
}
