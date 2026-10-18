import { and, eq, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import { dedupeTrimmedIds, type QuestionBankTest } from '@mms/shared';
import {
  tests,
  testQuestions,
  testSections,
  testSectionQuestions,
} from '../schema.js';
import { withTenant, withTenantRead, type TenantTransaction } from '../tenant-context.js';
import { syncTestChildren, testRowToRecord } from './questionBankTestsSync.js';

export { testRowToRecord } from './questionBankTestsSync.js';

export async function listTestsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<QuestionBankTest[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
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
      })
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), isNull(tests.deletedAt)))
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];

    const tIds = rows.map((r) => r.id);
    const [allTQs, allSections] = await Promise.all([
      tx
        .select({
          testId: testQuestions.testId,
          sortOrder: testQuestions.sortOrder,
          questionId: testQuestions.questionId,
        })
        .from(testQuestions)
        .where(
          and(
            eq(testQuestions.workspaceSubdomain, subdomain),
            inArray(testQuestions.testId, tIds),
          ),
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
          and(
            eq(testSections.workspaceSubdomain, subdomain),
            inArray(testSections.testId, tIds),
          ),
        ),
    ]);

    const qByTest = new Map<string, Array<{ index: number; qId: string }>>();
    for (const tq of allTQs) {
      const arr = qByTest.get(tq.testId) ?? [];
      arr.push({ index: tq.sortOrder, qId: tq.questionId });
      qByTest.set(tq.testId, arr);
    }

    const secIds = allSections.map((s) => s.id);
    const allSecQs = secIds.length > 0
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

    return rows.map((r) => {
      const testQs = (qByTest.get(r.id) ?? [])
        .sort((a, b) => a.index - b.index)
        .map((q) => q.qId);

      const testSecs = (secByTest.get(r.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => {
          const sqs = (qBySec.get(s.id) ?? [])
            .sort((a, b) => a.index - b.index)
            .map((q) => q.qId);
          return {
            id: s.id,
            title: s.title,
            instructions: s.instructions,
            questionIds: sqs,
          };
        });

      return testRowToRecord(r, testQs, testSecs);
    });
  });
}

export async function findTestById(tenant: string, id: string): Promise<QuestionBankTest | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
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
      })
      .from(tests)
      .where(and(eq(tests.workspaceSubdomain, subdomain), eq(tests.id, cleanId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const [allTQs, allSections] = await Promise.all([
      tx
        .select({
          testId: testQuestions.testId,
          sortOrder: testQuestions.sortOrder,
          questionId: testQuestions.questionId,
        })
        .from(testQuestions)
        .where(
          and(
            eq(testQuestions.workspaceSubdomain, subdomain),
            eq(testQuestions.testId, cleanId),
          ),
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
          and(
            eq(testSections.workspaceSubdomain, subdomain),
            eq(testSections.testId, cleanId),
          ),
        ),
    ]);

    const testQs = allTQs.sort((a, b) => a.sortOrder - b.sortOrder).map((q) => q.questionId);
    const secIds = allSections.map((s) => s.id);
    const allSecQs = secIds.length > 0
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

    const testSecs = allSections
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => {
        const sqs = (qBySec.get(s.id) ?? [])
          .sort((a, b) => a.index - b.index)
          .map((q) => q.qId);
        return {
          id: s.id,
          title: s.title,
          instructions: s.instructions,
          questionIds: sqs,
        };
      });

    return testRowToRecord(row, testQs, testSecs);
  });
}

export async function findTestsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: 'active' | 'deleted' | 'all'; includeDeleted?: boolean },
): Promise<QuestionBankTest[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === 'deleted';
    const isAll = options?.deleted === 'all';
    const deletedCond = isDeletedOnly
      ? isNotNull(tests.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(tests.deletedAt)
          : isNull(tests.deletedAt);

    const conditions = [
      eq(tests.workspaceSubdomain, subdomain),
      inArray(tests.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select({
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
      })
      .from(tests)
      .where(and(...conditions));
    if (rows.length === 0) return [];

    const tIds = rows.map((r) => r.id);
    const [allTQs, allSections] = await Promise.all([
      tx
        .select({
          testId: testQuestions.testId,
          sortOrder: testQuestions.sortOrder,
          questionId: testQuestions.questionId,
        })
        .from(testQuestions)
        .where(
          and(
            eq(testQuestions.workspaceSubdomain, subdomain),
            inArray(testQuestions.testId, tIds),
          ),
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
          and(
            eq(testSections.workspaceSubdomain, subdomain),
            inArray(testSections.testId, tIds),
          ),
        ),
    ]);

    const qByTest = new Map<string, Array<{ index: number; qId: string }>>();
    for (const tq of allTQs) {
      const arr = qByTest.get(tq.testId) ?? [];
      arr.push({ index: tq.sortOrder, qId: tq.questionId });
      qByTest.set(tq.testId, arr);
    }

    const secIds = allSections.map((s) => s.id);
    const allSecQs = secIds.length > 0
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

    return rows.map((r) => {
      const testQs = (qByTest.get(r.id) ?? [])
        .sort((a, b) => a.index - b.index)
        .map((q) => q.qId);

      const testSecs = (secByTest.get(r.id) ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => {
          const sqs = (qBySec.get(s.id) ?? [])
            .sort((a, b) => a.index - b.index)
            .map((q) => q.qId);
          return {
            id: s.id,
            title: s.title,
            instructions: s.instructions,
            questionIds: sqs,
          };
        });

      return testRowToRecord(r, testQs, testSecs);
    });
  });
}

export async function saveTest(tenant: string, record: QuestionBankTest): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(tests)
      .values({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        categoryId: record.categoryId ?? null,
        difficulty: record.difficulty ?? 'mixed',
        duration: record.duration ?? 60,
        examClass: record.examClass ?? null,
        classId: record.classId ?? null,
        totalMarks: record.totalMarks ?? null,
        instructions: record.instructions ?? null,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [tests.workspaceSubdomain, tests.id],
        set: {
          name: record.name,
          categoryId: record.categoryId ?? null,
          difficulty: record.difficulty ?? 'mixed',
          duration: record.duration ?? 60,
          examClass: record.examClass ?? null,
          classId: record.classId ?? null,
          totalMarks: record.totalMarks ?? null,
          instructions: record.instructions ?? null,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });

    await syncTestChildren(tx, subdomain, record);
  });
}

type Transaction = TenantTransaction;

async function insertTestChildrenTx(
  tx: Transaction,
  subdomain: string,
  records: QuestionBankTest[],
): Promise<void> {
  const allTestQuestions = records.flatMap((record) =>
    (record.questionIds ?? []).map((qId, i) => ({
      workspaceSubdomain: subdomain,
      testId: record.id,
      questionId: qId,
      sortOrder: i,
    })),
  );
  if (allTestQuestions.length > 0) {
    await tx.insert(testQuestions).values(allTestQuestions);
  }

  const allSections = records.flatMap((record) =>
    (record.sections ?? []).map((sec, i) => ({
      id: sec.id,
      workspaceSubdomain: subdomain,
      testId: record.id,
      title: sec.title,
      instructions: sec.instructions ?? '',
      sortOrder: i,
    })),
  );
  if (allSections.length > 0) {
    await tx.insert(testSections).values(allSections);
  }

  const allSectionQuestions = records.flatMap((record) =>
    (record.sections ?? []).flatMap((sec) =>
      (sec.questionIds ?? []).map((qId, j) => ({
        workspaceSubdomain: subdomain,
        sectionId: sec.id,
        questionId: qId,
        sortOrder: j,
      })),
    ),
  );
  if (allSectionQuestions.length > 0) {
    await tx.insert(testSectionQuestions).values(allSectionQuestions);
  }
}

export async function bulkSaveTests(tenant: string, records: QuestionBankTest[]): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, QuestionBankTest>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    const testIds = uniqueRecords.map((r) => r.id);

    await tx
      .insert(tests)
      .values(
        uniqueRecords.map((record) => ({
          id: record.id,
          workspaceSubdomain: subdomain,
          name: record.name,
          categoryId: record.categoryId ?? null,
          difficulty: record.difficulty ?? 'mixed',
          duration: record.duration ?? 60,
          examClass: record.examClass ?? null,
          classId: record.classId ?? null,
          totalMarks: record.totalMarks ?? null,
          instructions: record.instructions ?? null,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [tests.workspaceSubdomain, tests.id],
        set: {
          name: sql`excluded.name`,
          categoryId: sql`excluded.category_id`,
          difficulty: sql`excluded.difficulty`,
          duration: sql`excluded.duration`,
          examClass: sql`excluded.exam_class`,
          classId: sql`excluded.class_id`,
          totalMarks: sql`excluded.total_marks`,
          instructions: sql`excluded.instructions`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });

    const sectionIds: string[] = [];
    for (let i = 0; i < uniqueRecords.length; i++) {
      const sections = uniqueRecords[i]?.sections;
      if (sections) {
        for (let j = 0; j < sections.length; j++) {
          const sid = sections[j]?.id;
          if (sid) sectionIds.push(sid);
        }
      }
    }

    const deleteOps: Promise<unknown>[] = [
      tx.delete(testSections).where(and(eq(testSections.workspaceSubdomain, subdomain), inArray(testSections.testId, testIds))),
      tx.delete(testQuestions).where(and(eq(testQuestions.workspaceSubdomain, subdomain), inArray(testQuestions.testId, testIds))),
    ];
    if (sectionIds.length > 0) {
      deleteOps.push(
        tx.delete(testSectionQuestions).where(and(eq(testSectionQuestions.workspaceSubdomain, subdomain), inArray(testSectionQuestions.sectionId, sectionIds))),
      );
    }
    await Promise.all(deleteOps);

    await insertTestChildrenTx(tx, subdomain, uniqueRecords);
  });
}

export async function replaceTestsForWorkspace(tenant: string, records: QuestionBankTest[]): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, QuestionBankTest>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(testSectionQuestions).where(eq(testSectionQuestions.workspaceSubdomain, subdomain));
    await tx.delete(testSections).where(eq(testSections.workspaceSubdomain, subdomain));
    await tx.delete(testQuestions).where(eq(testQuestions.workspaceSubdomain, subdomain));
    await tx.delete(tests).where(eq(tests.workspaceSubdomain, subdomain));

    if (uniqueRecords.length === 0) return;

    await tx.insert(tests).values(
      uniqueRecords.map((record) => ({
        id: record.id,
        workspaceSubdomain: subdomain,
        name: record.name,
        categoryId: record.categoryId ?? null,
        difficulty: record.difficulty ?? 'mixed',
        duration: record.duration ?? 60,
        examClass: record.examClass ?? null,
        classId: record.classId ?? null,
        totalMarks: record.totalMarks ?? null,
        instructions: record.instructions ?? null,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
        deletedBy: record.deletedBy ?? null,
        deletionReason: record.deletionReason ?? null,
        updatedAt: new Date(),
      })),
    );

    await insertTestChildrenTx(tx, subdomain, uniqueRecords);
  });
}
