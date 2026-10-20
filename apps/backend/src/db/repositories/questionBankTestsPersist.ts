import { and, eq, inArray, sql } from "drizzle-orm";
import type { QuestionBankTest } from "@mms/shared";
import { tests, testQuestions, testSections, testSectionQuestions } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { syncTestChildren } from "./questionBankTestsSync.js";

type Transaction = TenantTransaction;

export async function insertTestChildrenTx(
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
      instructions: sec.instructions ?? "",
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
        difficulty: record.difficulty ?? "mixed",
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
          difficulty: record.difficulty ?? "mixed",
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
          difficulty: record.difficulty ?? "mixed",
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
      tx
        .delete(testSections)
        .where(
          and(
            eq(testSections.workspaceSubdomain, subdomain),
            inArray(testSections.testId, testIds),
          ),
        ),
      tx
        .delete(testQuestions)
        .where(
          and(
            eq(testQuestions.workspaceSubdomain, subdomain),
            inArray(testQuestions.testId, testIds),
          ),
        ),
    ];
    if (sectionIds.length > 0) {
      deleteOps.push(
        tx
          .delete(testSectionQuestions)
          .where(
            and(
              eq(testSectionQuestions.workspaceSubdomain, subdomain),
              inArray(testSectionQuestions.sectionId, sectionIds),
            ),
          ),
      );
    }
    await Promise.all(deleteOps);

    await insertTestChildrenTx(tx, subdomain, uniqueRecords);
  });
}

export async function replaceTestsForWorkspace(
  tenant: string,
  records: QuestionBankTest[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, QuestionBankTest>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx
      .delete(testSectionQuestions)
      .where(eq(testSectionQuestions.workspaceSubdomain, subdomain));
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
        difficulty: record.difficulty ?? "mixed",
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
