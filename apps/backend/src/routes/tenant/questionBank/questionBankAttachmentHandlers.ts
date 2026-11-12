import type { User, questionBankContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canWriteCollection } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import {
  attachQuestionMedia,
  detachQuestionMedia,
} from "../../../questionBank/use-cases/questionAttachmentUseCases.js";
import { mappedFailure } from "./questionBankLifecycleHandlers.js";

/**
 * Question media endpoints (migration 0242). Split from the contract router to keep that file inside
 * the 300-line ceiling; transport and authorization live here, the rules live in the use case.
 */

const forbidden = {
  status: 403 as const,
  body: { type: "forbidden", message: "Insufficient permissions" },
};

export const addQuestionAttachmentHandler = async ({
  params: { id },
  body,
  request,
}: ContractRouteArgs<(typeof questionBankContract)["addQuestionAttachment"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["addQuestionAttachment"]>
> => {
  const user = request.user as User;
  if (!canWriteCollection(user, "questions")) return forbidden;
  try {
    const attachment = await withTenant(
      String(request.tenant?.id),
      () =>
        attachQuestionMedia(user, {
          questionId: id,
          kind: body.kind,
          optionIndex: body.optionIndex ?? null,
          url: body.url,
          name: body.name,
          mime: body.mime,
          size: body.size,
        }),
      { readOnly: false },
    );
    return { status: 200 as const, body: { attachment } };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to attach the media" },
    };
  }
};

export const removeQuestionAttachmentHandler = async ({
  params: { id, attachmentId },
  request,
}: ContractRouteArgs<(typeof questionBankContract)["removeQuestionAttachment"]>): Promise<
  ContractRouteResponse<(typeof questionBankContract)["removeQuestionAttachment"]>
> => {
  const user = request.user as User;
  if (!canWriteCollection(user, "questions")) return forbidden;
  try {
    await withTenant(
      String(request.tenant?.id),
      () => detachQuestionMedia(user, { questionId: id, attachmentId }),
      { readOnly: false },
    );
    return { status: 200 as const, body: { success: true as const } };
  } catch (error) {
    const mapped = mappedFailure(error);
    if (mapped) return mapped;
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to remove the media" },
    };
  }
};
