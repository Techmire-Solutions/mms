import {
  EXAM_ERROR_DETAILS_LIMIT,
  type Exam,
  type ExamGateStudentDetail,
  type ExamResult,
} from "@mms/shared";
import { examEligibilityRepository as repo } from "../repository/examEligibilityAdapter.js";
import { examinationsRepository } from "../repository/examinationsRepositoryAdapter.js";
import { HttpDomainError, NotFoundError } from "../../lib/httpErrors.js";

/**
 * Exam eligibility gate for result entry.
 *
 * A student may not have a result recorded for an exam whose attendance threshold they miss, unless
 * an audited override exists. The tenant is an explicit input (not ambient request state) so both
 * writers can run it: the HTTP `beforeSave` hook and the queued CSV marks import, which previously
 * bypassed this gate entirely.
 *
 * Two queries for the whole batch: the exams (for the per-exam marks bound) and one batched
 * eligibility read (roster + attendance + overrides + the effective gate).
 */

export interface BlockedStudent {
  examId: string;
  studentId: string;
  attendancePct: number | null;
  requiredPct: number;
  state: "blocked" | "unknown";
}

export async function assertExamResultsEligible(
  tenant: string,
  results: readonly ExamResult[],
  /** Exams the caller already loaded (the HTTP submission path) — avoids a duplicate query. */
  preloadedExams?: readonly Exam[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  if (!subdomain || results.length === 0) return;

  const examIds = [...new Set(results.map((result) => result.examId).filter(Boolean))];
  if (examIds.length === 0) return;

  const [exams, eligibilityByExam] = await Promise.all([
    preloadedExams ?? examinationsRepository.findExamsByIds(subdomain, examIds),
    repo.loadExamEligibilityBatch(subdomain, examIds),
  ]);
  const examsById = new Map(exams.map((exam) => [exam.id, exam]));

  const outOfRange: Array<{
    examId: string;
    studentId: string;
    marksObtained: number;
    totalMarks: number;
  }> = [];
  const notEnrolled: Array<{ examId: string; studentId: string }> = [];
  const unknown: Array<{
    examId: string;
    studentId: string;
    attendancePct: number | null;
    requiredPct: number | null;
  }> = [];
  const blocked: BlockedStudent[] = [];

  for (const examId of examIds) {
    const exam = examsById.get(examId);
    if (!exam) continue;
    const rows = results.filter((result) => result.examId === examId);
    const view = eligibilityByExam.get(examId);
    const roster = view?.rows ?? [];
    const rosterIds = new Set(roster.map((row) => row.studentId));

    // Marks sanity: the DB cannot compare against the exam's total, so the app must.
    for (const result of rows) {
      const studentId = String(result.studentId);
      const marks = Number(result.marksObtained ?? 0);
      if (!Number.isFinite(marks) || marks < 0 || marks > exam.totalMarks) {
        outOfRange.push({ examId, studentId, marksObtained: marks, totalMarks: exam.totalMarks });
      }
      if (!rosterIds.has(studentId)) {
        notEnrolled.push({ examId, studentId });
      }
    }

    if (!view || view.requiredPct === null) continue;

    const byStudent = new Map(roster.map((row) => [row.studentId, row]));
    for (const result of rows) {
      const studentId = String(result.studentId);
      const row = byStudent.get(studentId);
      // Unknown roster membership was already reported as `notEnrolled` above — never skipped.
      if (!row) continue;
      if (row.state === "blocked") {
        blocked.push({
          examId,
          studentId,
          attendancePct: row.attendancePct,
          requiredPct: row.requiredPct ?? view.requiredPct,
          state: "blocked",
        });
      } else if (row.state === "unknown") {
        unknown.push({
          examId,
          studentId,
          attendancePct: row.attendancePct,
          requiredPct: row.requiredPct ?? view.requiredPct,
        });
      }
    }
  }

  const counts = {
    outOfRange: outOfRange.length,
    notEnrolled: notEnrolled.length,
    unknown: unknown.length,
    blocked: blocked.length,
  };
  /** Structured, machine-readable context for the rejected batch (ids + decision evidence). */
  const gateDetails = (students: ExamGateStudentDetail[]): Record<string, unknown> => ({
    ...(examIds.length === 1 ? { examId: examIds[0] } : {}),
    students: students.slice(0, EXAM_ERROR_DETAILS_LIMIT),
    counts,
    truncated: students.length > EXAM_ERROR_DETAILS_LIMIT,
  });

  if (outOfRange.length > 0) {
    throw new HttpDomainError(
      400,
      "exam_marks_out_of_range",
      `Marks must be between 0 and the exam total: ${outOfRange
        .slice(0, 5)
        .map((row) => `${row.studentId} (${row.marksObtained}/${row.totalMarks})`)
        .join(", ")}`,
      {
        details: gateDetails(
          outOfRange.map((row) => ({
            examId: row.examId,
            studentId: row.studentId,
            marksObtained: row.marksObtained,
            totalMarks: row.totalMarks,
          })),
        ),
      },
    );
  }
  if (notEnrolled.length > 0) {
    throw new HttpDomainError(
      409,
      "exam_student_not_enrolled",
      `These students are not enrolled in the exam's class: ${notEnrolled
        .slice(0, 5)
        .map((row) => `${row.studentId} @ ${row.examId}`)
        .join(", ")}`,
      {
        details: gateDetails(
          notEnrolled.map((row) => ({ examId: row.examId, studentId: row.studentId })),
        ),
      },
    );
  }
  if (unknown.length > 0) {
    throw new HttpDomainError(
      409,
      "exam_eligibility_unknown",
      `Attendance cannot be evaluated yet for: ${unknown
        .slice(0, 5)
        .map((row) => `${row.studentId} @ ${row.examId}`)
        .join(", ")}. Mark the roster or grant an override.`,
      {
        details: gateDetails(
          unknown.map((row) => ({
            examId: row.examId,
            studentId: row.studentId,
            attendancePct: row.attendancePct,
            requiredPct: row.requiredPct,
            state: "unknown" as const,
          })),
        ),
      },
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
      {
        details: gateDetails(
          blocked.map((row) => ({
            examId: row.examId,
            studentId: row.studentId,
            attendancePct: row.attendancePct,
            requiredPct: row.requiredPct,
            state: "blocked" as const,
          })),
        ),
      },
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
  input: { examId: string; minAttendancePct: number | null; actorId: string; reason?: string },
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
