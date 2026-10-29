import { and, inArray } from "drizzle-orm";
import {
  dedupeTrimmedIds,
  type QuestionBankQuestion,
  type RepositoryListOptions,
} from "@mms/shared";
import { buildTenantSoftDeleteConditions } from "../../services/genericRelationalService.js";
import { questions } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { hydrateQuestionRecords } from "./questionBankQuestionsSync.js";

export { questionRowToRecord } from "./questionBankQuestionsSync.js";
export {
  saveQuestion,
  bulkSaveQuestions,
  replaceQuestionsForWorkspace,
  bulkSoftDeleteQuestions,
  bulkRestoreQuestions,
} from "./questionBankQuestionsPersist.js";

export type ListQuestionsOptions = RepositoryListOptions;

export async function listQuestionsByWorkspace(
  tenant: string,
  options?: ListQuestionsOptions,
): Promise<QuestionBankQuestion[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
  return withTenantRead(subdomain, async (tx) => {
    const conditions = buildTenantSoftDeleteConditions(questions, subdomain, deletedFilter);
    const rows = await tx
      .select({
        id: questions.id,
        workspaceSubdomain: questions.workspaceSubdomain,
        type: questions.type,
        difficulty: questions.difficulty,
        questionLanguage: questions.questionLanguage,
        text: questions.text,
        answer: questions.answer,
        marks: questions.marks,
        deletedAt: questions.deletedAt,
        deletedBy: questions.deletedBy,
        deletionReason: questions.deletionReason,
        restoredAt: questions.restoredAt,
        restoredBy: questions.restoredBy,
        deletedWithCascade: questions.deletedWithCascade,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
      })
      .from(questions)
      .where(and(...conditions))
      .orderBy(questions.id)
      .limit(limit)
      .offset(offset);
    return hydrateQuestionRecords(tx, subdomain, rows);
  });
}

export async function findQuestionsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<QuestionBankQuestion[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const deletedFilter = options?.deleted ?? (options?.includeDeleted ? "all" : "active");
    const conditions = [
      ...buildTenantSoftDeleteConditions(questions, subdomain, deletedFilter),
      inArray(questions.id, cleanIds),
    ];

    const rows = await tx
      .select({
        id: questions.id,
        workspaceSubdomain: questions.workspaceSubdomain,
        type: questions.type,
        difficulty: questions.difficulty,
        questionLanguage: questions.questionLanguage,
        text: questions.text,
        answer: questions.answer,
        marks: questions.marks,
        deletedAt: questions.deletedAt,
        deletedBy: questions.deletedBy,
        deletionReason: questions.deletionReason,
        restoredAt: questions.restoredAt,
        restoredBy: questions.restoredBy,
        deletedWithCascade: questions.deletedWithCascade,
        createdAt: questions.createdAt,
        updatedAt: questions.updatedAt,
      })
      .from(questions)
      .where(and(...conditions));
    return hydrateQuestionRecords(tx, subdomain, rows);
  });
}

export async function findQuestionById(
  tenant: string,
  id: string,
): Promise<QuestionBankQuestion | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const questionsList = await findQuestionsByIds(tenant, [cleanId], { deleted: "all" });
  return questionsList[0] ?? null;
}
