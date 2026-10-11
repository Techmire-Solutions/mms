import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { dedupeTrimmedIds, type QuestionBankQuestion } from "@mms/shared";
import {
  questions,
  questionCategories,
  questionOptions,
  questionTags,
  questionCitations,
} from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { syncQuestionChildren } from "./questionBankQuestionsSync.js";

type Transaction = TenantTransaction;

function toQuestionInsert(record: QuestionBankQuestion, subdomain: string) {
  return {
    id: record.id,
    workspaceSubdomain: subdomain,
    type: record.type,
    difficulty: record.difficulty,
    questionLanguage: record.questionLanguage ?? "en",
    text: record.text,
    answer: record.answer,
    marks: record.marks ?? 1,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    deletedBy: record.deletedBy ?? null,
    deletionReason: record.deletionReason ?? null,
    updatedAt: new Date(),
  };
}

export async function saveQuestion(tenant: string, record: QuestionBankQuestion): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await tx
      .insert(questions)
      .values(toQuestionInsert(record, subdomain))
      .onConflictDoUpdate({
        target: [questions.workspaceSubdomain, questions.id],
        set: {
          type: record.type,
          difficulty: record.difficulty,
          questionLanguage: record.questionLanguage ?? "en",
          text: record.text,
          answer: record.answer,
          marks: record.marks ?? 1,
          deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
          deletedBy: record.deletedBy ?? null,
          deletionReason: record.deletionReason ?? null,
          updatedAt: new Date(),
        },
      });

    await syncQuestionChildren(tx, subdomain, record);
  });
}

async function insertQuestionChildrenTx(
  tx: Transaction,
  subdomain: string,
  records: QuestionBankQuestion[],
): Promise<void> {
  const allCatRows = records.flatMap((record) => {
    const catIds = record.categoryIds ?? (record.categoryId ? [record.categoryId] : []);
    return catIds.map((catId) => ({
      workspaceSubdomain: subdomain,
      questionId: record.id,
      categoryId: catId,
    }));
  });
  if (allCatRows.length > 0) {
    await tx.insert(questionCategories).values(allCatRows);
  }

  const allOptRows = records.flatMap((record) =>
    (record.options ?? []).map((opt, i) => ({
      id: `${record.id}_opt_${i}`,
      workspaceSubdomain: subdomain,
      questionId: record.id,
      optionIndex: i,
      optionText: opt,
    })),
  );
  if (allOptRows.length > 0) {
    await tx.insert(questionOptions).values(allOptRows);
  }

  const allTagRows = records.flatMap((record) =>
    (record.tags ?? []).map((tag) => ({
      workspaceSubdomain: subdomain,
      questionId: record.id,
      tag,
    })),
  );
  if (allTagRows.length > 0) {
    await tx.insert(questionTags).values(allTagRows);
  }

  const allCitRows = records.flatMap((record) =>
    (record.sourceCitations ?? []).map((c, i) => ({
      id: `${record.id}_cit_${i}`,
      workspaceSubdomain: subdomain,
      questionId: record.id,
      bookId: c.bookId,
      citation: JSON.stringify(c.citation ?? {}),
    })),
  );
  if (allCitRows.length > 0) {
    await tx.insert(questionCitations).values(allCitRows);
  }
}

export async function bulkSaveQuestions(
  tenant: string,
  records: QuestionBankQuestion[],
): Promise<void> {
  if (records.length === 0) return;
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, QuestionBankQuestion>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    const qIds = uniqueRecords.map((r) => r.id);

    await tx
      .insert(questions)
      .values(uniqueRecords.map((record) => toQuestionInsert(record, subdomain)))
      .onConflictDoUpdate({
        target: [questions.workspaceSubdomain, questions.id],
        set: {
          type: sql`excluded.type`,
          difficulty: sql`excluded.difficulty`,
          questionLanguage: sql`excluded.question_language`,
          text: sql`excluded.text`,
          answer: sql`excluded.answer`,
          marks: sql`excluded.marks`,
          deletedAt: sql`excluded.deleted_at`,
          deletedBy: sql`excluded.deleted_by`,
          deletionReason: sql`excluded.deletion_reason`,
          updatedAt: new Date(),
        },
      });

    await Promise.all([
      tx
        .delete(questionCategories)
        .where(
          and(
            eq(questionCategories.workspaceSubdomain, subdomain),
            inArray(questionCategories.questionId, qIds),
          ),
        ),
      tx
        .delete(questionOptions)
        .where(
          and(
            eq(questionOptions.workspaceSubdomain, subdomain),
            inArray(questionOptions.questionId, qIds),
          ),
        ),
      tx
        .delete(questionTags)
        .where(
          and(
            eq(questionTags.workspaceSubdomain, subdomain),
            inArray(questionTags.questionId, qIds),
          ),
        ),
      tx
        .delete(questionCitations)
        .where(
          and(
            eq(questionCitations.workspaceSubdomain, subdomain),
            inArray(questionCitations.questionId, qIds),
          ),
        ),
    ]);

    await insertQuestionChildrenTx(tx, subdomain, uniqueRecords);
  });
}

export async function replaceQuestionsForWorkspace(
  tenant: string,
  records: QuestionBankQuestion[],
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();

  const dedupedMap = new Map<string, QuestionBankQuestion>();
  for (const record of records) {
    dedupedMap.set(record.id, record);
  }
  const uniqueRecords = Array.from(dedupedMap.values());

  await withTenant(subdomain, async (tx) => {
    await tx.delete(questionCitations).where(eq(questionCitations.workspaceSubdomain, subdomain));
    await tx.delete(questionTags).where(eq(questionTags.workspaceSubdomain, subdomain));
    await tx.delete(questionOptions).where(eq(questionOptions.workspaceSubdomain, subdomain));
    await tx.delete(questionCategories).where(eq(questionCategories.workspaceSubdomain, subdomain));
    await tx.delete(questions).where(eq(questions.workspaceSubdomain, subdomain));

    if (uniqueRecords.length === 0) return;

    await tx
      .insert(questions)
      .values(uniqueRecords.map((record) => toQuestionInsert(record, subdomain)));

    await insertQuestionChildrenTx(tx, subdomain, uniqueRecords);
  });
}

export async function bulkSoftDeleteQuestions(
  tenant: string,
  ids: string[],
  deletedBy?: string,
  deletionReason?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(questions)
      .set({
        deletedAt: now,
        deletedBy: deletedBy || null,
        deletionReason: deletionReason || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(questions.workspaceSubdomain, subdomain),
          inArray(questions.id, uniqueIds),
          isNull(questions.deletedAt),
        ),
      )
      .returning({ id: questions.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreQuestions(
  tenant: string,
  ids: string[],
  _userId?: string,
): Promise<{ succeeded: number; failed: number }> {
  const subdomain = tenant.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (uniqueIds.length === 0) return { succeeded: 0, failed: 0 };
  const now = new Date();
  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(questions)
      .set({
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(questions.workspaceSubdomain, subdomain),
          inArray(questions.id, uniqueIds),
          isNotNull(questions.deletedAt),
        ),
      )
      .returning({ id: questions.id });

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
