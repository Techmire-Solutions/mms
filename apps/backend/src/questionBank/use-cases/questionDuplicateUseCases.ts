import { hasComparableStem } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { questionBankRepository } from "../repository/questionBankRepositoryAdapter.js";
import type { SimilarQuestionMatch } from "../repository/questionBankRepository.js";

/**
 * Duplicate / near-duplicate detection for authoring (migration 0242 follow-up).
 *
 * Advisory by design: two questions can be legitimately similar, so the endpoint ranks and reports,
 * and the author decides. The score comes from the shared deterministic scorer.
 */
export async function checkQuestionDuplicates(input: {
  text: string;
  excludeId?: string;
  limit?: number;
}): Promise<{ matches: SimilarQuestionMatch[] }> {
  const tenant = getRequestTenant();
  if (!tenant) return { matches: [] };
  // Very short stems produce meaningless trigram overlap; skip the query entirely.
  if (!hasComparableStem(input.text)) return { matches: [] };

  if (!questionBankRepository.findSimilarQuestions) return { matches: [] };
  return { matches: await questionBankRepository.findSimilarQuestions(tenant, input) };
}
