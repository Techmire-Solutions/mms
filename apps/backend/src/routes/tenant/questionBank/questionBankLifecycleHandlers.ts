import {
  requiresQuestionApprovalAuthority,
  type User,
  type questionBankContract,
} from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";
import { withTenant } from "../../../db/tenant-context.js";
import { questionBankLifecycleUseCases } from "../../../questionBank/use-cases/questionBankLifecycleUseCases.js";
import { assemblePaper } from "../../../questionBank/use-cases/paperAssemblyUseCases.js";
import { mapConstraintError, mapDomainError } from "../../../lib/httpErrors.js";

/**
 * Question Bank lifecycle endpoints (migration 0241).
 *
 * Split out of `questionBankContractRouter.ts` to keep that file inside the 300-line ceiling. Routes
 * own transport and authorization; legality, the transaction and the audit live behind the use cases.
 */

/** Map a domain error to its declared status instead of flattening every refusal into a 500. */
export function mappedFailure(
  error: unknown,
): { status: 400 | 403 | 404 | 409 | 422; body: unknown } | null {
  const mapped = mapDomainError(error);
  if (mapped) {
    return { status: mapped.status as 400 | 403 | 404 | 409 | 422, body: mapped.body };
  }
  // A trigger/constraint failure (23514/23503/23505/22003) is client-correctable, not a 500.
  const constraint = mapConstraintError(error);
  if (constraint) {
    return {
      status: constraint.status as 400 | 409,
      body: constraint.body,
    };
  }
  return null;
}

const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};

export const setQuestionStatusHandler = async ({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof questionBankContract)["setQuestionStatus"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["setQuestionStatus"]>
> => {
  const user = request.user as User;
  // Approving or retiring decides what papers may consume, so it needs approver authority
  // (`questionBank.delete`): a teacher may author and submit, not approve.
  const allowed = requiresQuestionApprovalAuthority(body.status)
    ? userHasPermission(user, "questionBank.delete")
    : canWriteCollection(user, "questions");
  if (!allowed) return forbidden;
  try {
    const question = await withTenant(
      String(request.tenant?.id),
      () =>
        questionBankLifecycleUseCases.setQuestionStatus(user, {
          id,
          status: body.status,
          reason: body.reason,
        }),
      { readOnly: false },
    );
    return { status: 200 as const, body: { question } };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to update the question status" },
    };
  }
};

export const duplicateQuestionHandler = async ({
  params: { id },
  request,
}: ContractRouteArgs<(typeof questionBankContract)["duplicateQuestion"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["duplicateQuestion"]>
> => {
  const user = request.user as User;
  if (!canWriteCollection(user, "questions")) return forbidden;
  try {
    const question = await withTenant(
      String(request.tenant?.id),
      () => questionBankLifecycleUseCases.duplicateQuestion(user, id),
      { readOnly: false },
    );
    return { status: 200 as const, body: { question } };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to duplicate the question" },
    };
  }
};

export const setTestPublishedHandler = async ({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof questionBankContract)["setTestPublished"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["setTestPublished"]>
> => {
  const user = request.user as User;
  if (!canDeleteCollection(user, "tests")) return forbidden;
  try {
    const test = await withTenant(
      String(request.tenant?.id),
      () =>
        questionBankLifecycleUseCases.setTestPublished(user, {
          testId: id,
          published: body.published,
        }),
      { readOnly: false },
    );
    return { status: 200 as const, body: { test } };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to publish the paper" },
    };
  }
};

export const assemblePaperHandler = async ({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof questionBankContract)["assemblePaper"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["assemblePaper"]>
> => {
  const user = request.user as User;
  if (!canWriteCollection(user, "questions")) return forbidden;
  try {
    const result = await withTenant(
      String(request.tenant?.id),
      () => assemblePaper(user, { testId: id, blueprint: body }),
      { readOnly: false },
    );
    return { status: 200 as const, body: result };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to assemble the paper" },
    };
  }
};
