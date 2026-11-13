import { and, asc, eq, inArray } from "drizzle-orm";
import type { QuestionAttachment } from "@mms/shared";
import { questionAttachments } from "../schema.js";
import { withTenant, type TenantTransaction } from "../tenant-context.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { auditQuestionBankEntity } from "./questionBankAudit.js";

/**
 * Question media persistence (migration 0242).
 *
 * Attachment rows are server-managed and are the reference record the orphan sweep consults: a file
 * is "referenced" exactly while a row stores its URL. Soft-deleting a question keeps the rows (and so
 * the files) for restore; a hard purge cascades the rows and leaves the files to the sweep.
 */

function toRecord(row: {
  id: string;
  kind: string;
  optionIndex: number | null;
  name: string;
  mime: string;
  size: number | string;
  url: string;
  sortOrder: number;
}): QuestionAttachment {
  return {
    id: row.id,
    kind: row.kind as QuestionAttachment["kind"],
    optionIndex: row.optionIndex,
    name: row.name,
    mime: row.mime,
    size: Number(row.size ?? 0),
    url: row.url,
    sortOrder: row.sortOrder,
  };
}

/** Batched projection for hydration; one query for the whole page. */
export async function listQuestionAttachmentsTx(
  tx: TenantTransaction,
  subdomain: string,
  questionIds: readonly string[],
): Promise<Map<string, QuestionAttachment[]>> {
  const byQuestion = new Map<string, QuestionAttachment[]>();
  if (questionIds.length === 0) return byQuestion;

  const rows = await tx
    .select({
      id: questionAttachments.id,
      kind: questionAttachments.kind,
      optionIndex: questionAttachments.optionIndex,
      name: questionAttachments.name,
      mime: questionAttachments.mime,
      size: questionAttachments.size,
      url: questionAttachments.url,
      sortOrder: questionAttachments.sortOrder,
      questionId: questionAttachments.questionId,
    })
    .from(questionAttachments)
    .where(
      and(
        eq(questionAttachments.workspaceSubdomain, subdomain),
        inArray(questionAttachments.questionId, [...questionIds]),
      ),
    )
    .orderBy(asc(questionAttachments.sortOrder), asc(questionAttachments.id));

  for (const row of rows) {
    const list = byQuestion.get(row.questionId) ?? [];
    list.push(toRecord(row));
    byQuestion.set(row.questionId, list);
  }
  return byQuestion;
}

export async function listQuestionAttachments(
  tenant: string,
  questionIds: readonly string[],
): Promise<Map<string, QuestionAttachment[]>> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, (tx) => listQuestionAttachmentsTx(tx, subdomain, questionIds));
}

export interface NewQuestionAttachment {
  id: string;
  questionId: string;
  kind: "stem" | "option";
  optionIndex: number | null;
  name: string;
  mime: string;
  size: number;
  url: string;
  actorId?: string | null;
}

export async function addQuestionAttachment(
  tenant: string,
  input: NewQuestionAttachment,
): Promise<QuestionAttachment> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const existing = await tx
      .select({ id: questionAttachments.id })
      .from(questionAttachments)
      .where(
        and(
          eq(questionAttachments.workspaceSubdomain, subdomain),
          eq(questionAttachments.questionId, input.questionId),
        ),
      );
    const [inserted] = await tx
      .insert(questionAttachments)
      .values({
        id: input.id,
        workspaceSubdomain: subdomain,
        questionId: input.questionId,
        kind: input.kind,
        optionIndex: input.optionIndex,
        name: input.name,
        mime: input.mime,
        size: input.size,
        url: input.url,
        sortOrder: existing.length,
      })
      .returning();
    await auditQuestionBankEntity(tx, {
      subdomain,
      tableName: "question_attachments",
      recordId: input.id,
      actionType: "CREATE",
      actorId: input.actorId ?? null,
      newState: { questionId: input.questionId, kind: input.kind, url: input.url },
    });
    return toRecord(inserted);
  });
}

/** Removes one attachment row and returns its URL so the caller can unlink the file. */
export async function removeQuestionAttachment(
  tenant: string,
  input: { questionId: string; attachmentId: string; actorId?: string | null },
): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const [removed] = await tx
      .delete(questionAttachments)
      .where(
        and(
          eq(questionAttachments.workspaceSubdomain, subdomain),
          eq(questionAttachments.questionId, input.questionId),
          eq(questionAttachments.id, input.attachmentId),
        ),
      )
      .returning({ url: questionAttachments.url });
    if (!removed) {
      throw new NotFoundError(`Attachment ${input.attachmentId} not found on ${input.questionId}`);
    }
    await auditQuestionBankEntity(tx, {
      subdomain,
      tableName: "question_attachments",
      recordId: input.attachmentId,
      actionType: "DELETE",
      actorId: input.actorId ?? null,
      oldState: { questionId: input.questionId, url: removed.url },
    });
    return removed.url;
  });
}

/** True when any question still references this file URL (tenant-scoped). */
export async function isQuestionAttachmentReferenced(
  tenant: string,
  urls: readonly string[],
): Promise<boolean> {
  if (urls.length === 0) return false;
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const rows = await tx
      .select({ id: questionAttachments.id })
      .from(questionAttachments)
      .where(
        and(
          eq(questionAttachments.workspaceSubdomain, subdomain),
          inArray(questionAttachments.url, [...urls]),
        ),
      )
      .limit(1);
    return rows.length > 0;
  });
}
