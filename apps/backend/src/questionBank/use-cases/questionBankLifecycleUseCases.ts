import { randomUUID } from "node:crypto";
import type { QuestionBankQuestion, QuestionBankTest, QuestionStatus, User } from "@mms/shared";
import type { QuestionBankRepository } from "../repository/questionBankRepository.js";
import { questionBankRepository } from "../repository/questionBankRepositoryAdapter.js";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { NotFoundError } from "../../lib/httpErrors.js";

/**
 * Question Bank lifecycle orchestration (migration 0241).
 *
 * Routes own transport and authorization; the legality rules are pure (`questionWriteGuards`), the
 * transaction and CAS live in the repository, and this layer ties the write to its audit trail and
 * live-refresh broadcast.
 */
export function createQuestionBankLifecycleUseCases(
  repo: QuestionBankRepository = questionBankRepository,
) {
  return {
    /** Move a question through `draft → under_review → approved → retired`. */
    setQuestionStatus: async (
      user: User,
      input: { id: string; status: QuestionStatus; reason?: string | null },
    ): Promise<QuestionBankQuestion> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new NotFoundError("Tenant context required");
      if (!repo.updateQuestionStatus) throw new Error("Lifecycle write is not available");

      const updated = await repo.updateQuestionStatus(tenant, {
        id: input.id,
        to: input.status,
        actorId: String(user.id),
        reason: input.reason ?? null,
      });

      await broadcastCollection("questions");
      return updated;
    },

    /** Clone a question as a new `draft` — the sanctioned "new revision" path. */
    duplicateQuestion: async (user: User, sourceId: string): Promise<QuestionBankQuestion> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new NotFoundError("Tenant context required");
      if (!repo.duplicateQuestionRow) throw new Error("Duplicate is not available");

      const created = await repo.duplicateQuestionRow(tenant, {
        sourceId,
        newId: `q-${randomUUID()}`,
        actorId: String(user.id),
      });

      await broadcastCollection("questions");
      return created;
    },

    /**
     * Publish (freeze + snapshot) or unpublish an exam paper.
     *
     * The response is the refreshed paper so the client can see the lock immediately.
     */
    setTestPublished: async (
      user: User,
      input: { testId: string; published: boolean },
    ): Promise<QuestionBankTest> => {
      const tenant = getRequestTenant();
      if (!tenant) throw new NotFoundError("Tenant context required");
      if (!repo.setPaperPublished) throw new Error("Paper publication is not available");

      await repo.setPaperPublished(tenant, {
        testId: input.testId,
        published: input.published,
        actorId: String(user.id),
      });
      const test = await repo.findTestById(tenant, input.testId);
      if (!test) throw new NotFoundError(`Paper ${input.testId} not found`);

      await broadcastCollection("tests");
      return test;
    },
  };
}

export const questionBankLifecycleUseCases = createQuestionBankLifecycleUseCases();
