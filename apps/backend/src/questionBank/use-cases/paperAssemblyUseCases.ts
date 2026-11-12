import {
  paperBlueprintSchema,
  type BlueprintDeficit,
  type QuestionBankTest,
  type User,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { questionBankRepository } from "../repository/questionBankRepositoryAdapter.js";

/**
 * Blueprint assembly orchestration (migration 0242).
 *
 * The route owns transport and authorization; the engine and the transactional write live behind
 * `assemblePaperForTest`. Deficits are a first-class result: a blueprint that cannot be fully met
 * still produces a paper and a report saying exactly which bucket fell short.
 */
export async function assemblePaper(
  user: User,
  input: { testId: string; blueprint: unknown },
): Promise<{
  test: QuestionBankTest | null;
  seedUsed: string;
  totalMarks: number;
  selectedCount: number;
  deficits: BlueprintDeficit[];
}> {
  const tenant = getRequestTenant();
  if (!tenant) throw new NotFoundError("Tenant context required");

  const blueprint = paperBlueprintSchema.parse(input.blueprint);
  if (!questionBankRepository.assemblePaper) throw new NotFoundError("Assembly is unavailable");
  const outcome = await questionBankRepository.assemblePaper(tenant, {
    testId: input.testId,
    blueprint,
    actorId: String(user.id),
  });
  const test = await questionBankRepository.findTestById(tenant, input.testId);

  await broadcastCollection("tests");

  return {
    test,
    seedUsed: outcome.result.seedUsed,
    totalMarks: outcome.result.totalMarks,
    selectedCount: outcome.questionIds.length,
    deficits: outcome.result.deficits,
  };
}
