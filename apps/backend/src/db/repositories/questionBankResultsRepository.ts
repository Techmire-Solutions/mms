import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { dedupeTrimmedIds, type QuestionBankResult } from "@mms/shared";
import { assessmentResults, assessmentAnswers } from "../schema.js";
import { withTenantRead } from "../tenant-context.js";
import { mapAuditTimestamps } from "./repositoryMappers.js";

// Re-export persistence functions for backward compatibility
export {
  saveResult,
  bulkSaveResults,
  replaceResultsForWorkspace,
  deleteQuestionBankByWorkspace,
} from "./questionBankResultsPersist.js";

type ResultRow = typeof assessmentResults.$inferSelect;

export function resultRowToRecord(
  row: ResultRow,
  answers: Record<string, string> = {},
  scores: Record<string, number> = {},
): QuestionBankResult {
  const audit = mapAuditTimestamps(row);
  const result: QuestionBankResult = {
    id: row.id,
    testId: row.testId,
    studentId: row.studentId,
    studentName: row.studentName,
    submittedAt: row.submittedAt,
    answers,
    scores,
    deletedAt: audit.deletedAt ?? null,
    deletedBy: audit.deletedBy ?? null,
    deletionReason: audit.deletionReason ?? null,
  };

  return result;
}

export async function listResultsByWorkspace(
  tenant: string,
  options?: { limit?: number; offset?: number },
): Promise<QuestionBankResult[]> {
  const subdomain = tenant.trim().toLowerCase();
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 5000);
  const offset = Math.max(options?.offset ?? 0, 0);
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: assessmentResults.id,
        testId: assessmentResults.testId,
        studentId: assessmentResults.studentId,
        studentName: assessmentResults.studentName,
        submittedAt: assessmentResults.submittedAt,
        deletedAt: assessmentResults.deletedAt,
        deletedBy: assessmentResults.deletedBy,
        deletionReason: assessmentResults.deletionReason,
      })
      .from(assessmentResults)
      .where(
        and(
          eq(assessmentResults.workspaceSubdomain, subdomain),
          isNull(assessmentResults.deletedAt),
        ),
      )
      .orderBy(assessmentResults.id)
      .limit(limit)
      .offset(offset);
    if (rows.length === 0) return [];

    const resIds = rows.map((r) => r.id);
    const allAnswers = await tx
      .select({
        resultId: assessmentAnswers.resultId,
        questionId: assessmentAnswers.questionId,
        studentAnswer: assessmentAnswers.studentAnswer,
        score: assessmentAnswers.score,
      })
      .from(assessmentAnswers)
      .where(
        and(
          eq(assessmentAnswers.workspaceSubdomain, subdomain),
          inArray(assessmentAnswers.resultId, resIds),
        ),
      );

    const answersByRes = new Map<string, Record<string, string>>();
    const scoresByRes = new Map<string, Record<string, number>>();

    for (const a of allAnswers) {
      const ansMap = answersByRes.get(a.resultId) ?? {};
      ansMap[a.questionId] = a.studentAnswer;
      answersByRes.set(a.resultId, ansMap);

      const scoreMap = scoresByRes.get(a.resultId) ?? {};
      scoreMap[a.questionId] = Number(a.score ?? 0);
      scoresByRes.set(a.resultId, scoreMap);
    }

    return rows.map((r) =>
      resultRowToRecord(
        r as unknown as ResultRow,
        answersByRes.get(r.id) ?? {},
        scoresByRes.get(r.id) ?? {},
      ),
    );
  });
}

export async function findResultById(
  tenant: string,
  id: string,
): Promise<QuestionBankResult | null> {
  const cleanId = id?.trim();
  if (!cleanId) return null;
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select({
        id: assessmentResults.id,
        testId: assessmentResults.testId,
        studentId: assessmentResults.studentId,
        studentName: assessmentResults.studentName,
        submittedAt: assessmentResults.submittedAt,
        deletedAt: assessmentResults.deletedAt,
        deletedBy: assessmentResults.deletedBy,
        deletionReason: assessmentResults.deletionReason,
      })
      .from(assessmentResults)
      .where(
        and(eq(assessmentResults.workspaceSubdomain, subdomain), eq(assessmentResults.id, cleanId)),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const allAnswers = await tx
      .select({
        resultId: assessmentAnswers.resultId,
        questionId: assessmentAnswers.questionId,
        studentAnswer: assessmentAnswers.studentAnswer,
        score: assessmentAnswers.score,
      })
      .from(assessmentAnswers)
      .where(
        and(
          eq(assessmentAnswers.workspaceSubdomain, subdomain),
          eq(assessmentAnswers.resultId, cleanId),
        ),
      );

    const ansMap: Record<string, string> = {};
    const scoreMap: Record<string, number> = {};

    for (const a of allAnswers) {
      ansMap[a.questionId] = a.studentAnswer;
      scoreMap[a.questionId] = Number(a.score ?? 0);
    }

    return resultRowToRecord(row as unknown as ResultRow, ansMap, scoreMap);
  });
}

export async function findResultsByIds(
  tenant: string,
  ids: string[],
  options?: { deleted?: "active" | "deleted" | "all"; includeDeleted?: boolean },
): Promise<QuestionBankResult[]> {
  const cleanIds = dedupeTrimmedIds(ids);
  if (cleanIds.length === 0) return [];
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const isDeletedOnly = options?.deleted === "deleted";
    const isAll = options?.deleted === "all";
    const deletedCond = isDeletedOnly
      ? isNotNull(assessmentResults.deletedAt)
      : isAll
        ? null
        : options?.includeDeleted
          ? isNotNull(assessmentResults.deletedAt)
          : isNull(assessmentResults.deletedAt);

    const conditions = [
      eq(assessmentResults.workspaceSubdomain, subdomain),
      inArray(assessmentResults.id, cleanIds),
    ];
    if (deletedCond) conditions.push(deletedCond);

    const rows = await tx
      .select({
        id: assessmentResults.id,
        testId: assessmentResults.testId,
        studentId: assessmentResults.studentId,
        studentName: assessmentResults.studentName,
        submittedAt: assessmentResults.submittedAt,
        deletedAt: assessmentResults.deletedAt,
        deletedBy: assessmentResults.deletedBy,
        deletionReason: assessmentResults.deletionReason,
      })
      .from(assessmentResults)
      .where(and(...conditions));
    if (rows.length === 0) return [];

    const resIds = rows.map((r) => r.id);
    const allAnswers = await tx
      .select({
        resultId: assessmentAnswers.resultId,
        questionId: assessmentAnswers.questionId,
        studentAnswer: assessmentAnswers.studentAnswer,
        score: assessmentAnswers.score,
      })
      .from(assessmentAnswers)
      .where(
        and(
          eq(assessmentAnswers.workspaceSubdomain, subdomain),
          inArray(assessmentAnswers.resultId, resIds),
        ),
      );

    const answersByRes = new Map<string, Record<string, string>>();
    const scoresByRes = new Map<string, Record<string, number>>();

    for (const a of allAnswers) {
      const ansMap = answersByRes.get(a.resultId) ?? {};
      ansMap[a.questionId] = a.studentAnswer;
      answersByRes.set(a.resultId, ansMap);

      const scoreMap = scoresByRes.get(a.resultId) ?? {};
      scoreMap[a.questionId] = Number(a.score ?? 0);
      scoresByRes.set(a.resultId, scoreMap);
    }

    return rows.map((r) =>
      resultRowToRecord(
        r as unknown as ResultRow,
        answersByRes.get(r.id) ?? {},
        scoresByRes.get(r.id) ?? {},
      ),
    );
  });
}
