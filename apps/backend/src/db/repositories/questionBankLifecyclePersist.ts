import { and, eq, sql } from "drizzle-orm";
import type { QuestionBankQuestion, QuestionStatus } from "@mms/shared";
import { questions } from "../schema.js";
import { withTenant } from "../tenant-context.js";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import { assertQuestionTransition } from "../../questionBank/domain/questionWriteGuards.js";
import {
  hydrateQuestionRecords,
  questionRowColumns,
  syncQuestionChildren,
} from "./questionBankQuestionsSync.js";
import { findReferencedQuestionIds } from "./questionBankQuestionWritePlan.js";
import { auditQuestionBankEntity } from "./questionBankAudit.js";

/**
 * Lifecycle persistence for Question Bank (migration 0241).
 *
 * Every mutation here runs in one transaction with the row read `FOR UPDATE`, so a status move and
 * the guard that judges it cannot race another writer. The legality rules themselves are pure and
 * live in `questionBank/domain/questionWriteGuards.ts`.
 */

export interface QuestionStatusChange {
  readonly id: string;
  readonly to: QuestionStatus;
  readonly actorId: string;
  readonly reason?: string | null;
}

/** Move one question through its authoring lifecycle; returns the updated record. */
export async function updateQuestionStatus(
  tenant: string,
  change: QuestionStatusChange,
): Promise<QuestionBankQuestion> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [row] = await tx
      .select(questionRowColumns)
      .from(questions)
      .where(and(eq(questions.workspaceSubdomain, subdomain), eq(questions.id, change.id)))
      .for("update");
    if (!row) throw new NotFoundError(`Question ${change.id} not found`);
    if (row.deletedAt) {
      throw new ConflictError(
        `Question ${change.id} is archived — restore it before changing its status`,
        "question_archived",
        { questionId: change.id },
      );
    }

    const referenced = (await findReferencedQuestionIds(tx, subdomain, [change.id])).has(change.id);
    assertQuestionTransition({
      id: change.id,
      from: row.status,
      to: change.to,
      referenced,
    });

    const [updated] = await tx
      .update(questions)
      .set({
        status: change.to,
        // A status move invalidates an in-flight content edit.
        version: sql`${questions.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(questions.workspaceSubdomain, subdomain),
          eq(questions.id, change.id),
          eq(questions.version, row.version),
        ),
      )
      .returning();
    if (!updated) {
      throw new ConflictError(
        `Question ${change.id} changed while its status was being updated — reload and retry`,
        "stale_write",
        { questionId: change.id },
      );
    }

    await auditQuestionBankEntity(tx, {
      subdomain,
      tableName: "questions",
      recordId: change.id,
      actionType: "UPDATE",
      actorId: change.actorId,
      oldState: { status: row.status },
      newState: { status: change.to, reason: change.reason ?? null },
      minimizeDelta: true,
    });

    const [record] = await hydrateQuestionRecords(tx, subdomain, [updated]);
    return record;
  });
}

/**
 * Clone a question as a new `draft` revision (the sanctioned path when an edit is refused because a
 * delivered paper already uses the original).
 */
export async function duplicateQuestionRow(
  tenant: string,
  input: { sourceId: string; newId: string; actorId?: string | null },
): Promise<QuestionBankQuestion> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [source] = await tx
      .select(questionRowColumns)
      .from(questions)
      .where(and(eq(questions.workspaceSubdomain, subdomain), eq(questions.id, input.sourceId)));
    if (!source) throw new NotFoundError(`Question ${input.sourceId} not found`);

    const [record] = await hydrateQuestionRecords(tx, subdomain, [source]);
    const clone: QuestionBankQuestion = {
      ...record,
      id: input.newId,
      status: "draft",
      version: undefined,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      restoredAt: null,
      restoredBy: null,
      deletedWithCascade: false,
    };

    await tx.insert(questions).values({
      id: clone.id,
      workspaceSubdomain: subdomain,
      type: clone.type,
      difficulty: clone.difficulty,
      questionLanguage: clone.questionLanguage,
      text: clone.text,
      answer: clone.answer,
      marks: clone.marks ?? 1,
      status: "draft",
    });
    await syncQuestionChildren(tx, subdomain, clone);
    await auditQuestionBankEntity(tx, {
      subdomain,
      tableName: "questions",
      recordId: clone.id,
      actionType: "CREATE",
      actorId: input.actorId ?? null,
      newState: { id: clone.id, sourceId: input.sourceId, status: "draft" },
    });

    const [created] = await hydrateQuestionRecords(
      tx,
      subdomain,
      await tx
        .select(questionRowColumns)
        .from(questions)
        .where(and(eq(questions.workspaceSubdomain, subdomain), eq(questions.id, clone.id))),
    );
    return created;
  });
}

export type { PaperPublicationChange } from "./questionBankPaperPublicationPersist.js";

/**
 * Publish (freeze) or unpublish an exam paper.
 *
 * Publishing stamps `published_at`/`published_by` and writes a `question_snapshot` per link, so the
 * paper remains reproducible after any later question change. Unpublishing is refused once results
 * exist — the same rule the exams module applies to published marks.
 */

export { setPaperPublished } from "./questionBankPaperPublicationPersist.js";
