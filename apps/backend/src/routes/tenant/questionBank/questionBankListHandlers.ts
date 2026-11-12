import {
  isQueryFlagTrue,
  type questionBankContract,
  serializeQuestionForClient,
  serializeQuestionsForClient,
  type QuestionBankQuestionSummary,
  type User,
} from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { questionBankUseCases } from "../../../questionBank/use-cases/questionBankUseCases.js";
import { mappedFailure } from "./questionBankLifecycleHandlers.js";

/**
 * Question list + picker handlers (extracted from the contract router to keep it under the 300-line
 * ceiling). Both serialize through the answer-key redactor.
 */

export const listQuestionsHandler = async ({
  query,
  request,
}: ContractRouteArgs<(typeof questionBankContract)["listQuestions"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["listQuestions"]>
> => {
  const user = request.user as User;
  if (!canReadCollection(user, "questions")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const includeDeleted = isQueryFlagTrue(query?.includeDeleted);
  if (includeDeleted && !canDeleteCollection(user, "questions")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  // The answer key is privileged: only a caller who may edit questions receives it.
  const answerVisible = canWriteCollection(user, "questions");
  const listKeys = [
    "page",
    "limit",
    "search",
    "categoryId",
    "difficulty",
    "status",
    "tag",
    "minUsage",
    "afterId",
    "sortField",
    "sortDir",
  ] as const;
  const wantsPage = listKeys.some(
    (key) => (query as Record<string, unknown> | undefined)?.[key] !== undefined,
  );
  try {
    if (wantsPage) {
      const result = await withTenant(
        String(request.tenant?.id),
        () => questionBankUseCases.loadQuestionsPage({ ...query, includeDeleted }),
        { readOnly: true },
      );
      return {
        status: 200 as const,
        body: {
          ...result,
          questions: serializeQuestionsForClient(result.questions, { answerVisible }),
        },
      };
    }
    const questions = await withTenant(
      String(request.tenant?.id),
      () => questionBankUseCases.loadQuestions({ includeDeleted }),
      { readOnly: true },
    );
    return {
      status: 200 as const,
      body: {
        questions: serializeQuestionsForClient(questions, { answerVisible }),
      },
    };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to list questions" },
    };
  }
};

export const pickerQuestionsHandler = async ({
  query,
  request,
}: ContractRouteArgs<(typeof questionBankContract)["pickerQuestions"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["pickerQuestions"]>
> => {
  const user = request.user as User;
  if (!canReadCollection(user, "questions")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => questionBankUseCases.loadQuestionsPicker(query ?? {}),
      { readOnly: true },
    );
    // A picker never needs the key, regardless of the caller's privilege.
    const questions = result.questions.map((question) =>
      serializeQuestionForClient(question, { answerVisible: false }),
    ) as QuestionBankQuestionSummary[];
    return {
      status: 200 as const,
      body: { ...result, questions },
    };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to load the question picker" },
    };
  }
};
