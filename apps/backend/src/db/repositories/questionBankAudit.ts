import type { QuestionBankQuestion } from "@mms/shared";
import type { TenantTransaction } from "../tenant-context.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

/**
 * Transactional audit for Question Bank writes.
 *
 * Audit rows are written with the same `tx` as the mutation: a failure aborts the write (fail-closed)
 * and a committed mutation can never exist without its audit row. `recordModernAuditEvent` fills the
 * actor from the request-bound user and the IP/endpoint/method/correlation id from the request audit
 * context, so callers only supply the state change.
 *
 * `minimizeDelta` reduces `oldState`/`newState` to the fields that actually changed — including the
 * answer key, which is exactly what an examiner audit needs to see.
 */

export const QUESTION_AUDIT_TABLE = "questions";

/** The fields a question audit needs; deliberately excludes derived/child rows. */
export interface QuestionAuditState {
  id: string;
  type: string;
  difficulty: string;
  questionLanguage: string;
  text: string;
  answer: string;
  options: readonly string[];
  marks: number;
  status: string;
  categoryIds: readonly string[];
  tags?: readonly string[];
}

/** Snapshot for before/after comparison (the answer key is part of the record). */
export function questionAuditState(record: QuestionBankQuestion): QuestionAuditState {
  return {
    id: record.id,
    type: record.type,
    difficulty: record.difficulty,
    questionLanguage: record.questionLanguage,
    text: record.text,
    answer: record.answer,
    options: [...(record.options ?? [])],
    marks: record.marks ?? 1,
    status: record.status ?? "draft",
    categoryIds: [...(record.categoryIds ?? [])],
    ...(record.tags && record.tags.length > 0 ? { tags: [...record.tags] } : {}),
  };
}

export async function auditQuestionCreated(
  tx: TenantTransaction,
  subdomain: string,
  record: QuestionBankQuestion,
  actorId?: string | null,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: QUESTION_AUDIT_TABLE,
    recordId: record.id,
    actionType: "CREATE",
    ...(actorId ? { realUserId: actorId } : {}),
    newState: questionAuditState(record),
  });
}

export async function auditQuestionUpdated(
  tx: TenantTransaction,
  subdomain: string,
  before: QuestionBankQuestion,
  after: QuestionBankQuestion,
  actorId?: string | null,
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: QUESTION_AUDIT_TABLE,
    recordId: after.id,
    actionType: "UPDATE",
    ...(actorId ? { realUserId: actorId } : {}),
    oldState: questionAuditState(before),
    newState: questionAuditState(after),
    minimizeDelta: true,
  });
}

export async function auditQuestionDeleted(
  tx: TenantTransaction,
  subdomain: string,
  input: {
    id: string;
    deletedBy?: string | null;
    deletionReason?: string | null;
    at: Date;
  },
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: QUESTION_AUDIT_TABLE,
    recordId: input.id,
    actionType: "DELETE",
    ...(input.deletedBy ? { realUserId: input.deletedBy } : {}),
    oldState: { deletedAt: null },
    newState: {
      deletedAt: input.at.toISOString(),
      deletedBy: input.deletedBy ?? null,
      deletionReason: input.deletionReason ?? null,
    },
  });
}

export async function auditQuestionRestored(
  tx: TenantTransaction,
  subdomain: string,
  input: { id: string; restoredBy?: string | null; at: Date },
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: subdomain,
    tableName: QUESTION_AUDIT_TABLE,
    recordId: input.id,
    actionType: "RESTORE",
    ...(input.restoredBy ? { realUserId: input.restoredBy } : {}),
    oldState: { deletedAt: "trashed" },
    newState: {
      deletedAt: null,
      restoredAt: input.at.toISOString(),
      restoredBy: input.restoredBy ?? null,
    },
  });
}

/** Generic lifecycle audit for the paper/attachment side (same transactional contract). */
export async function auditQuestionBankEntity(
  tx: TenantTransaction,
  input: {
    subdomain: string;
    tableName: string;
    recordId: string;
    actionType: "CREATE" | "UPDATE" | "DELETE" | "RESTORE";
    oldState?: unknown;
    newState?: unknown;
    minimizeDelta?: boolean;
    actorId?: string | null;
  },
): Promise<void> {
  await recordModernAuditEvent(tx, {
    workspaceSubdomain: input.subdomain,
    tableName: input.tableName,
    recordId: input.recordId,
    actionType: input.actionType,
    ...(input.actorId ? { realUserId: input.actorId } : {}),
    oldState: input.oldState,
    newState: input.newState,
    minimizeDelta: input.minimizeDelta,
  });
}
