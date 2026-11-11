import type { ExamResult, User } from "@mms/shared";
import { examEligibilityRepository as repo } from "../repository/examEligibilityAdapter.js";
import { examinationsUseCases } from "./examinationsUseCases.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { HttpDomainError, NotFoundError } from "../../lib/httpErrors.js";

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
  if (examIds.length === 0) return;

  /**
   * Two queries for the whole batch, not 6–7 per exam:
   * the exams (for the marks bound) and one batched eligibility read (roster + attendance +
   * overrides + the effective gate). The roster is the seat-holding enrollment set, so a withdrawn
   * student is rejected instead of silently skipped.
   */
  const [exams, eligibilityByExam] = await Promise.all([
    examinationsUseCases.loadExamsByIds(examIds),
    repo.loadExamEligibilityBatch(tenant, examIds),
  ]);
  const examsById = new Map(exams.map((exam) => [exam.id, exam]));

  const blocked: BlockedStudent[] = [];
  const unknown: string[] = [];
  const notEnrolled: string[] = [];
  const overMarks: string[] = [];

  for (const examId of examIds) {
    const exam = examsById.get(examId);
    if (!exam) continue;
    const rows = results.filter((result) => result.examId === examId);
    const view = eligibilityByExam.get(examId);
    const roster = view?.rows ?? [];
    const rosterIds = new Set(roster.map((row) => row.studentId));

    // Marks sanity: the DB cannot compare against the exam's total, so the app must.
    for (const result of rows) {
      const marks = Number(result.marksObtained ?? 0);
      if (!Number.isFinite(marks) || marks < 0 || marks > exam.totalMarks) {
        overMarks.push(`${result.studentId} (${marks}/${exam.totalMarks})`);
      }
      if (!rosterIds.has(String(result.studentId))) {
        notEnrolled.push(`${result.studentId} @ ${examId}`);
      }
    }

    if (!view || view.requiredPct === null) continue;

    const byStudent = new Map(roster.map((row) => [row.studentId, row]));
    for (const result of rows) {
      const row = byStudent.get(String(result.studentId));
      // Unknown roster membership was already reported as `notEnrolled` above — never skipped.
      if (!row) continue;
      if (row.state === "blocked") {
        blocked.push({
          studentId: result.studentId,
          attendancePct: row.attendancePct,
          requiredPct: row.requiredPct ?? view.requiredPct,
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

/** Revokes an audited eligibility override (evidence kept, reason audited). */
export async function revokeExamEligibilityOverride(
  tenant: string,
  input: { examId: string; studentId: string; reason: string; actorId: string },
) {
  const revoked = await repo.revokeEligibilityOverride(tenant, {
    examId: input.examId,
    studentId: input.studentId,
    reason: input.reason,
    revokedBy: input.actorId,
  });
  if (!revoked) throw new NotFoundError("No active eligibility override to revoke");
  return { success: true as const };
}

/** Grants an audited eligibility override for a blocked student. */
export async function grantExamEligibilityOverride(
  tenant: string,
  input: { examId: string; studentId: string; reason: string; grantedBy: string },
) {
  return repo.grantEligibilityOverride(tenant, input);
}

// Publication/un-publication moved to `examLifecycleUseCases.ts`: those are lifecycle transitions
// that need preconditions and an audited unlock reason, not a thin repository passthrough.
