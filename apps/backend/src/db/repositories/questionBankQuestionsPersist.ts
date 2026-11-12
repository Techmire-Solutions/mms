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
// OCC + restore-provenance upsert plumbing (0240) lives in its own module to keep this file inside
// the 300-line ceiling; see `questionBankQuestionUpsert.ts`.
import {
  assertEveryQuestionWritten,
  toQuestionInsert,
  upsertQuestionRows,
} from "./questionBankQuestionUpsert.js";
import { buildQuestionWritePlan } from "./questionBankQuestionWritePlan.js";
import {
  auditQuestionCreated,
  auditQuestionDeleted,
  auditQuestionRestored,
  auditQuestionUpdated,
} from "./questionBankAudit.js";

type Transaction = TenantTransaction;

export async function saveQuestion(tenant: string, record: QuestionBankQuestion): Promise<void> {
  // One path for every write: the bulk plan applies the merge/validate/guard rules even for a
  // single record, so the generic create/update path cannot bypass them.
  await bulkSaveQuestions(tenant, [record]);
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
    // Merge server-owned fields, normalize, validate and guard inside the write transaction.
    // Unchanged rows are skipped: no version bump, no child rewrite, no OCC churn for other editors.
    const plan = await buildQuestionWritePlan(tx, subdomain, uniqueRecords);
    if (plan.changed.length === 0) return;

    const qIds = plan.changed.map((record) => record.id);
    const withToken = plan.changed.filter((record) => typeof record.version === "number");
    const withoutToken = plan.changed.filter((record) => typeof record.version !== "number");
    const written = [
      ...(await upsertQuestionRows(tx, subdomain, withToken, true)),
      ...(await upsertQuestionRows(tx, subdomain, withoutToken, false)),
    ];
    assertEveryQuestionWritten(written, plan.changed);

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

    await insertQuestionChildrenTx(tx, subdomain, plan.changed);

    // Audit inside the same transaction: a mutation cannot commit without its row, and an audit
    // failure rolls the write back (fail-closed).
    for (const change of plan.changes) {
      if (change.isNew) {
        await auditQuestionCreated(tx, subdomain, change.after);
      } else if (change.before) {
        await auditQuestionUpdated(tx, subdomain, change.before, change.after);
      }
    }
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
        // A state change invalidates an in-flight edit: bump the token so a stale save 409s.
        version: sql`${questions.version} + 1`,
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

    for (const row of updated) {
      await auditQuestionDeleted(tx, subdomain, {
        id: row.id,
        deletedBy: deletedBy ?? null,
        deletionReason: deletionReason ?? null,
        at: now,
      });
    }

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}

export async function bulkRestoreQuestions(
  tenant: string,
  ids: string[],
  userId?: string,
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
        // Restore provenance (`mms-soft-delete` §2.5) — without it a trash row has no restore evidence.
        restoredAt: now,
        restoredBy: userId || null,
        deletedWithCascade: false,
        version: sql`${questions.version} + 1`,
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

    for (const row of updated) {
      await auditQuestionRestored(tx, subdomain, {
        id: row.id,
        restoredBy: userId ?? null,
        at: now,
      });
    }

    return {
      succeeded: updated.length,
      failed: uniqueIds.length - updated.length,
    };
  });
}
