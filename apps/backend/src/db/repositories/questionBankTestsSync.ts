import { and, eq, inArray } from 'drizzle-orm';
import { type QuestionBankTest } from '@mms/shared';
import {
  type tests,
  testQuestions,
  testSections,
  testSectionQuestions,
} from '../schema.js';
import { type TenantTransaction } from '../tenant-context.js';
import { mapAuditTimestamps } from './repositoryMappers.js';

type TestRow = typeof tests.$inferSelect;
type Transaction = TenantTransaction;

export function testRowToRecord(
  row: TestRow,
  questionIds: string[] = [],
  sections: Array<{ id: string; title: string; instructions: string; questionIds: string[] }> = [],
): QuestionBankTest {
  const audit = mapAuditTimestamps(row);
  const test: QuestionBankTest = {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    questionIds,
    difficulty: row.difficulty as QuestionBankTest['difficulty'],
    duration: row.duration,
    createdAt: audit.createdAt ?? (row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)),
    deletedAt: audit.deletedAt ?? null,
    deletedBy: audit.deletedBy ?? null,
    deletionReason: audit.deletionReason ?? null,
  };

  if (row.examClass) test.examClass = row.examClass;
  if (row.classId) test.classId = row.classId;
  if (row.totalMarks != null) test.totalMarks = row.totalMarks;
  if (row.instructions) test.instructions = row.instructions;
  if (sections.length > 0) test.sections = sections;

  return test;
}

export async function syncTestChildren(
  tx: Transaction,
  subdomain: string,
  record: QuestionBankTest,
): Promise<void> {
  const existingSections = await tx
    .select({ id: testSections.id })
    .from(testSections)
    .where(and(eq(testSections.workspaceSubdomain, subdomain), eq(testSections.testId, record.id)));

  if (existingSections.length > 0) {
    const sIds = existingSections.map((s) => s.id);
    await tx
      .delete(testSectionQuestions)
      .where(
        and(
          eq(testSectionQuestions.workspaceSubdomain, subdomain),
          inArray(testSectionQuestions.sectionId, sIds),
        ),
      );
  }

  await tx
    .delete(testSections)
    .where(and(eq(testSections.workspaceSubdomain, subdomain), eq(testSections.testId, record.id)));
  await tx
    .delete(testQuestions)
    .where(and(eq(testQuestions.workspaceSubdomain, subdomain), eq(testQuestions.testId, record.id)));

  if (record.questionIds && record.questionIds.length > 0) {
    await tx.insert(testQuestions).values(
      record.questionIds.map((qId, i) => ({
        workspaceSubdomain: subdomain,
        testId: record.id,
        questionId: qId,
        sortOrder: i,
      })),
    );
  }

  if (record.sections && record.sections.length > 0) {
    await tx.insert(testSections).values(
      record.sections.map((sec, i) => ({
        id: sec.id,
        workspaceSubdomain: subdomain,
        testId: record.id,
        title: sec.title,
        instructions: sec.instructions ?? '',
        sortOrder: i,
      })),
    );

    const secQuestions = record.sections.flatMap((sec) =>
      (sec.questionIds ?? []).map((sqId, j) => ({
        workspaceSubdomain: subdomain,
        sectionId: sec.id,
        questionId: sqId,
        sortOrder: j,
      })),
    );
    if (secQuestions.length > 0) {
      await tx.insert(testSectionQuestions).values(secQuestions);
    }
  }
}
