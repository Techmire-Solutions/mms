import { and, eq, inArray, sql } from "drizzle-orm";
import type { QuestionBankResult } from "@mms/shared";
import {
  questions,
  questionCategories,
  questionOptions,
  questionTags,
  questionCitations,
  tests,
  testQuestions,
  testSections,
  testSectionQuestions,
  assessmentResults,
  assessmentAnswers,
} from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";

async function syncResultChildren(
  tx: TenantTransaction,
  subdomain: string,
  record: QuestionBankResult,
): Promise<void> {
  await tx
    .delete(assessmentAnswers)
    .where(
      and(
        eq(assessmentAnswers.workspaceSubdomain, subdomain),
        eq(assessmentAnswers.resultId, record.id),
      ),
    );

  const questionIds = new Set<string>([
    ...Object.keys(record.answers ?? {}),
    ...Object.keys(record.scores ?? {}),
  ]);

  const answerRows = Array.from(questionIds).map((qId) => ({
    workspaceSubdomain: subdomain,
    resultId: record.id,
    questionId: qId,
    studentAnswer: record.answers?.[qId] ?? "",
    score: String(record.scores?.[qId] ?? 0),
  }));
  if (answerRows.length > 0) {
    await tx.insert(assessmentAnswers).values(answerRows);
  }
}

export async function saveResult(tenant: string, record: QuestionBankResult): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(assessmentResults)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        testId: record.testId,
        studentId: record.studentId,
        studentName: record.studentName ?? "",
        submittedAt: record.submittedAt,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [assessmentResults.workspaceSubdomain, assessmentResults.id],
        set: {
          testId: record.testId,
          studentId: record.studentId,
          studentName: record.studentName ?? "",
          submittedAt: record.submittedAt,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });

    await syncResultChildren(tx, subdomain, record);
  });
}

function flattenAnswerRows(subdomain: string, records: QuestionBankResult[]) {
  return records.flatMap((record) => {
    const questionIds = new Set<string>([
      ...Object.keys(record.answers ?? {}),
      ...Object.keys(record.scores ?? {}),
    ]);
    return Array.from(questionIds).map((qId) => ({
      workspaceSubdomain: subdomain,
      resultId: record.id,
      questionId: qId,
      studentAnswer: record.answers?.[qId] ?? "",
      score: record.scores?.[qId] != null ? String(record.scores[qId]) : "0",
    }));
  });
}

export async function bulkSaveResults(
  tenant: string,
  records: QuestionBankResult[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, QuestionBankResult>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    const resIds = uniqueRecords.map((r) => r.id);

    await tx
      .insert(assessmentResults)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          testId: record.testId,
          studentId: record.studentId,
          studentName: record.studentName ?? "",
          submittedAt: record.submittedAt,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [assessmentResults.workspaceSubdomain, assessmentResults.id],
        set: {
          testId: sql`excluded.test_id`,
          studentId: sql`excluded.student_id`,
          studentName: sql`excluded.student_name`,
          submittedAt: sql`excluded.submitted_at`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });

    await tx
      .delete(assessmentAnswers)
      .where(
        and(
          eq(assessmentAnswers.workspaceSubdomain, subdomain),
          inArray(assessmentAnswers.resultId, resIds),
        ),
      );

    const allAnswerRows = flattenAnswerRows(subdomain, uniqueRecords);
    if (allAnswerRows.length > 0) {
      await tx.insert(assessmentAnswers).values(allAnswerRows);
    }
  });
}

export async function replaceResultsForWorkspace(
  tenant: string,
  records: QuestionBankResult[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, QuestionBankResult>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(assessmentAnswers).where(eq(assessmentAnswers.workspaceSubdomain, subdomain));
    await tx.delete(assessmentResults).where(eq(assessmentResults.workspaceSubdomain, subdomain));

    if (uniqueRecords.length === 0) return;

    await tx.insert(assessmentResults).values(
      uniqueRecords.map((record) => ({
        id: record.id,
        workspaceSubdomain: subdomain,
        testId: record.testId,
        studentId: record.studentId,
        studentName: record.studentName ?? "",
        submittedAt: record.submittedAt,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })),
    );

    const allAnswerRows = flattenAnswerRows(subdomain, uniqueRecords);
    if (allAnswerRows.length > 0) {
      await tx.insert(assessmentAnswers).values(allAnswerRows);
    }
  });
}

export async function deleteQuestionBankByWorkspace(workspaceSubdomain: string): Promise<void> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx.delete(assessmentAnswers).where(eq(assessmentAnswers.workspaceSubdomain, subdomain));
    await tx.delete(assessmentResults).where(eq(assessmentResults.workspaceSubdomain, subdomain));
    await tx
      .delete(testSectionQuestions)
      .where(eq(testSectionQuestions.workspaceSubdomain, subdomain));
    await tx.delete(testSections).where(eq(testSections.workspaceSubdomain, subdomain));
    await tx.delete(testQuestions).where(eq(testQuestions.workspaceSubdomain, subdomain));
    await tx.delete(tests).where(eq(tests.workspaceSubdomain, subdomain));
    await tx.delete(questionCitations).where(eq(questionCitations.workspaceSubdomain, subdomain));
    await tx.delete(questionTags).where(eq(questionTags.workspaceSubdomain, subdomain));
    await tx.delete(questionOptions).where(eq(questionOptions.workspaceSubdomain, subdomain));
    await tx.delete(questionCategories).where(eq(questionCategories.workspaceSubdomain, subdomain));
    await tx.delete(questions).where(eq(questions.workspaceSubdomain, subdomain));
  });
}
