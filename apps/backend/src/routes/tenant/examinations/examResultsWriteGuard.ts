import type { ExamResult, User } from "@mms/shared";
import { examinationsUseCases } from "../../../examinations/use-cases/examinationsUseCases.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { assertTeacherAnyClassScope } from "../../../sessions/use-cases/teacherSectionScope.js";
import { assertExamResultsEligible } from "../../../examinations/use-cases/examEligibilityGate.js";

/**
 * Bulk marks entry guard: attendance eligibility first (a result may not be recorded for a student
 * below the exam's threshold without an audited override), then the teacher row-scope, then the
 * `markedBy` stamp.
 */
export async function scopeAndStampExamResults(
  user: User,
  results: ExamResult[],
): Promise<ExamResult[]> {
  await assertExamResultsEligible(user, results);
  const tenant = getRequestTenant();
  if (tenant) {
    const examIds = [...new Set(results.map((result) => result.examId).filter(Boolean))];
    const examsById = await examinationsUseCases.loadExamsByIds(examIds);
    await assertTeacherAnyClassScope(
      user,
      tenant,
      examsById.map((exam) =>
        (exam.classIds ?? []).map((classId) => ({ classId, date: exam.date })),
      ),
    );
  }
  return results.map((result) => ({ ...result, markedBy: user.id }));
}
