import type { User, questionBankContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { checkQuestionDuplicates } from "../../../questionBank/use-cases/questionDuplicateUseCases.js";
import { mappedFailure } from "./questionBankLifecycleHandlers.js";

/** Near-duplicate lookup for the authoring form (advisory, read-only). */
export const checkQuestionDuplicatesHandler = async ({
  body,
  request,
}: ContractRouteArgs<(typeof questionBankContract)["checkQuestionDuplicates"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["checkQuestionDuplicates"]>
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
      () =>
        checkQuestionDuplicates({
          text: body.text,
          excludeId: body.excludeId,
          limit: body.limit,
        }),
      { readOnly: true },
    );
    return { status: 200 as const, body: result };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to check for duplicates" },
    };
  }
};
