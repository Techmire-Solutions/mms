import { and, asc, eq, inArray } from "drizzle-orm";
import type { QuestionBankTest } from "@mms/shared";
import { testQuestions, testSectionQuestions, testSections, tests } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";
import { assertPaperCompositionEditable } from "../../questionBank/domain/questionWriteGuards.js";

/**
 * Freeze a published paper's question set.
 *
 * Publishing is only meaningful if the paper cannot be re-composed afterwards: the 0240/0241 guard
 * protects a question's content, but replacing the links would swap what the delivered paper was made
 * of without editing any question. Runs inside the caller's transaction, after the paper rows are
 * locked.
 */

function canonicalComposition(
  questionIds: readonly string[],
  sections: readonly { id: string; questionIds: readonly string[] }[],
): string {
  const questions = questionIds.join(",");
  const sectionPart = sections.map((section) => `${section.id}:${section.questionIds.join(",")}`);
  return `q:${questions}|s:${sectionPart.join(";")}`;
}

export async function assertPaperCompositionsEditable(
  tx: TenantTransaction,
  subdomain: string,
  records: readonly QuestionBankTest[],
): Promise<void> {
  if (records.length === 0) return;
  const ids = [...new Set(records.map((record) => record.id))];

  const storedTests = await tx
    .select({ id: tests.id, publishedAt: tests.publishedAt })
    .from(tests)
    .where(and(eq(tests.workspaceSubdomain, subdomain), inArray(tests.id, ids)))
    .for("update");
  const published = new Set(
    storedTests.filter((row) => row.publishedAt !== null).map((row) => row.id),
  );
  if (published.size === 0) return;

  const [questionLinks, sectionRows] = await Promise.all([
    tx
      .select({ testId: testQuestions.testId, questionId: testQuestions.questionId })
      .from(testQuestions)
      .where(
        and(
          eq(testQuestions.workspaceSubdomain, subdomain),
          inArray(testQuestions.testId, [...published]),
        ),
      )
      .orderBy(asc(testQuestions.sortOrder)),
    tx
      .select({ id: testSections.id, testId: testSections.testId })
      .from(testSections)
      .where(
        and(
          eq(testSections.workspaceSubdomain, subdomain),
          inArray(testSections.testId, [...published]),
        ),
      )
      .orderBy(asc(testSections.sortOrder)),
  ]);

  const sectionIds = sectionRows.map((row) => row.id);
  const sectionLinks =
    sectionIds.length > 0
      ? await tx
          .select({
            sectionId: testSectionQuestions.sectionId,
            questionId: testSectionQuestions.questionId,
          })
          .from(testSectionQuestions)
          .where(
            and(
              eq(testSectionQuestions.workspaceSubdomain, subdomain),
              inArray(testSectionQuestions.sectionId, sectionIds),
            ),
          )
          .orderBy(asc(testSectionQuestions.sortOrder))
      : [];

  const questionsByTest = new Map<string, string[]>();
  for (const row of questionLinks) {
    const list = questionsByTest.get(row.testId) ?? [];
    list.push(row.questionId);
    questionsByTest.set(row.testId, list);
  }
  const sectionQuestions = new Map<string, string[]>();
  for (const row of sectionLinks) {
    const list = sectionQuestions.get(row.sectionId) ?? [];
    list.push(row.questionId);
    sectionQuestions.set(row.sectionId, list);
  }
  const sectionsByTest = new Map<string, { id: string; questionIds: string[] }[]>();
  for (const row of sectionRows) {
    const list = sectionsByTest.get(row.testId) ?? [];
    list.push({ id: row.id, questionIds: sectionQuestions.get(row.id) ?? [] });
    sectionsByTest.set(row.testId, list);
  }

  for (const record of records) {
    if (!published.has(record.id)) continue;
    const current = canonicalComposition(
      questionsByTest.get(record.id) ?? [],
      sectionsByTest.get(record.id) ?? [],
    );
    const next = canonicalComposition(
      record.questionIds ?? [],
      (record.sections ?? []).map((section) => ({
        id: section.id,
        questionIds: section.questionIds ?? [],
      })),
    );
    assertPaperCompositionEditable({
      testId: record.id,
      publishedAt: new Date(),
      compositionChanged: current !== next,
    });
  }
}
