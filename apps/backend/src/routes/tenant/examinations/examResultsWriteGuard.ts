import type { ExamResult, User } from '@mms/shared';
import { examinationsUseCases } from '../../../examinations/use-cases/examinationsUseCases.js';
import { getRequestTenant } from '../../../lib/tenantContext.js';
import { assertTeacherAnyClassScope } from '../../../sessions/use-cases/teacherSectionScope.js';

/** Bulk marks entry guard: teacher must teach one of each exam's classes on the exam date; stamps `markedBy`. */
export async function scopeAndStampExamResults(user: User, results: ExamResult[]): Promise<ExamResult[]> {
  const tenant = getRequestTenant();
  if (tenant) {
    const examIds = [...new Set(results.map((result) => result.examId).filter(Boolean))];
    const examsById = await examinationsUseCases.loadExamsByIds(examIds);
    await assertTeacherAnyClassScope(user, tenant, examsById.map((exam) =>
      (exam.classIds ?? []).map((classId) => ({ classId, date: exam.date }))));
  }
  return results.map((result) => ({ ...result, markedBy: user.id }));
}
