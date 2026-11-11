import type { ExamResult, User } from "@mms/shared";
import { examinationsUseCases } from "./examinationsUseCases.js";
import { examEligibilityRepository as eligibilityRepo } from "../repository/examEligibilityAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import {
  assertTeacherAnyClassScope,
  assertTeacherExamScope,
  type ClassSectionDate,
} from "../../sessions/use-cases/teacherSectionScope.js";
import { assertExamResultsEligible } from "./examEligibilityGate.js";

/**
 * Marks-submission authorization and stamping — a domain use case, not a route concern.
 *
 * Composes three rules — attendance eligibility, teacher row-scope, and the server-side `markedBy`
 * stamp — so the route layer owns transport only. The rules that must hold *inside* the write
 * transaction (OCC token, published/archived/cancelled lock) live in the marks repository, because
 * a guard that runs before the transaction can always be raced by a publish.
 *
 * Teacher scope is **section-level**: each mark's student carries the section of their seat-holding
 * enrollment, and a faculty-linked teacher must be staffed on that exact section for the exam date.
 * A user without a faculty link is refused outright (office staff with `examinations.write` could
 * otherwise mark any class); only the coordinator bypass (`sessions.delete`) skips the rule.
 */
export async function authorizeAndStampExamResults(
  user: User,
  results: ExamResult[],
): Promise<ExamResult[]> {
  await assertExamResultsEligible(user, results);
  const stamped = results.map((result) => ({ ...result, markedBy: user.id }));

  const tenant = getRequestTenant();
  if (!tenant || results.length === 0) return stamped;

  const examIds = [...new Set(results.map((result) => result.examId).filter(Boolean))];
  const [exams, sections] = await Promise.all([
    examinationsUseCases.loadExamsByIds(examIds),
    eligibilityRepo.loadExamStudentSections(tenant, examIds),
  ]);
  const examsById = new Map(exams.map((exam) => [exam.id, exam]));
  const sectionByKey = new Map(
    sections.map((section) => [`${section.examId}|${section.studentId}`, section]),
  );

  const datedEntries: ClassSectionDate[] = [];
  for (const result of results) {
    const exam = examsById.get(result.examId);
    if (!exam?.date) continue;
    const section = sectionByKey.get(`${result.examId}|${result.studentId}`);
    datedEntries.push({
      classId: section?.classId ?? (exam.classIds ?? [])[0] ?? "",
      sectionId: section?.sectionId ?? null,
      onDate: exam.date,
    });
  }

  if (datedEntries.length > 0) {
    await assertTeacherExamScope(user, tenant, datedEntries);
  }

  // Exams without a date cannot resolve date-based staffing; keep the class-level rule for them.
  const undated = exams.filter((exam) => !exam.date);
  if (undated.length > 0) {
    await assertTeacherAnyClassScope(
      user,
      tenant,
      undated.map((exam) => (exam.classIds ?? []).map((classId) => ({ classId, date: "" }))),
    );
  }

  return stamped;
}
