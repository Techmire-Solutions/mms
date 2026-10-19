import { and, eq, inArray } from "drizzle-orm";
import { tests, testQuestions, testSections, testSectionQuestions } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

export const testSelectFields = {
  id: tests.id,
  workspaceSubdomain: tests.workspaceSubdomain,
  name: tests.name,
  categoryId: tests.categoryId,
  difficulty: tests.difficulty,
  duration: tests.duration,
  examClass: tests.examClass,
  classId: tests.classId,
  totalMarks: tests.totalMarks,
  instructions: tests.instructions,
  deletedAt: tests.deletedAt,
  deletedBy: tests.deletedBy,
  deletionReason: tests.deletionReason,
  restoredAt: tests.restoredAt,
  restoredBy: tests.restoredBy,
  deletedWithCascade: tests.deletedWithCascade,
  createdAt: tests.createdAt,
  updatedAt: tests.updatedAt,
};

export interface TestHydratedChildren {
  testQs: string[];
  testSecs: Array<{
    id: string;
    title: string;
    instructions: string;
    questionIds: string[];
  }>;
}

export async function fetchTestsChildrenTx(
  tx: TenantTransaction,
  subdomain: string,
  testIds: string[],
): Promise<Map<string, TestHydratedChildren>> {
  const resultMap = new Map<string, TestHydratedChildren>();
  if (testIds.length === 0) return resultMap;

  const [allTQs, allSections] = await Promise.all([
    tx
      .select({
        testId: testQuestions.testId,
        sortOrder: testQuestions.sortOrder,
        questionId: testQuestions.questionId,
      })
      .from(testQuestions)
      .where(
        and(eq(testQuestions.workspaceSubdomain, subdomain), inArray(testQuestions.testId, testIds)),
      ),
    tx
      .select({
        id: testSections.id,
        testId: testSections.testId,
        title: testSections.title,
        instructions: testSections.instructions,
        sortOrder: testSections.sortOrder,
      })
      .from(testSections)
      .where(
        and(eq(testSections.workspaceSubdomain, subdomain), inArray(testSections.testId, testIds)),
      ),
  ]);

  const qByTest = new Map<string, Array<{ index: number; qId: string }>>();
  for (const tq of allTQs) {
    const arr = qByTest.get(tq.testId) ?? [];
    arr.push({ index: tq.sortOrder, qId: tq.questionId });
    qByTest.set(tq.testId, arr);
  }

  const secIds = allSections.map((s) => s.id);
  const allSecQs =
    secIds.length > 0
      ? await tx
          .select({
            sectionId: testSectionQuestions.sectionId,
            sortOrder: testSectionQuestions.sortOrder,
            questionId: testSectionQuestions.questionId,
          })
          .from(testSectionQuestions)
          .where(
            and(
              eq(testSectionQuestions.workspaceSubdomain, subdomain),
              inArray(testSectionQuestions.sectionId, secIds),
            ),
          )
      : [];

  const qBySec = new Map<string, Array<{ index: number; qId: string }>>();
  for (const sq of allSecQs) {
    const arr = qBySec.get(sq.sectionId) ?? [];
    arr.push({ index: sq.sortOrder, qId: sq.questionId });
    qBySec.set(sq.sectionId, arr);
  }

  const secByTest = new Map<string, typeof allSections>();
  for (const s of allSections) {
    const arr = secByTest.get(s.testId) ?? [];
    arr.push(s);
    secByTest.set(s.testId, arr);
  }

  for (const tId of testIds) {
    const testQs = (qByTest.get(tId) ?? []).sort((a, b) => a.index - b.index).map((q) => q.qId);

    const testSecs = (secByTest.get(tId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => {
        const sqs = (qBySec.get(s.id) ?? []).sort((a, b) => a.index - b.index).map((q) => q.qId);
        return {
          id: s.id,
          title: s.title,
          instructions: s.instructions,
          questionIds: sqs,
        };
      });

    resultMap.set(tId, { testQs, testSecs });
  }

  return resultMap;
}
