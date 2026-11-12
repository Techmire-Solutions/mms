import type { QuestionBankListPageResult, QuestionBankListQuery } from "@mms/shared";
import { listQuestionsPage } from "./questionBankRepositoryList.js";

/**
 * Paper-builder picker: approved questions only, paged and ordered for stable browsing.
 * Answer-key redaction happens at the route boundary, not here.
 */
/**
 * Paper-builder picker: approved questions only, paged and ordered for stable browsing.
 * Answer-key redaction happens at the route boundary, not here.
 */
export async function listQuestionsPicker(
  tenant: string,
  query: QuestionBankListQuery,
): Promise<QuestionBankListPageResult> {
  const result = await listQuestionsPage(tenant, {
    ...query,
    status: "approved",
    sortField: "updatedAt",
    sortDir: "desc",
    limit: Math.min(query.limit ?? 50, 100),
  });
  return {
    questions: result.questions,
    total: result.total,
    page: result.page,
    limit: result.limit,
    hasMore: result.hasMore,
  };
}
