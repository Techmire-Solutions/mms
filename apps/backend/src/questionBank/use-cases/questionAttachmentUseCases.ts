import { randomUUID } from "node:crypto";
import type { QuestionAttachment, User } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { NotFoundError, ValidationError } from "../../lib/httpErrors.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { questionBankRepository } from "../repository/questionBankRepositoryAdapter.js";
import { questionMediaUrlFor } from "../../lib/questionMediaPolicy.js";
import { deleteQuestionMediaFile } from "../../services/questionMediaStorageService.js";

export interface QuestionAttachmentInput {
  kind: "stem" | "option";
  optionIndex?: number | null;
  url: string;
  name: string;
  mime: string;
  size: number;
}

/**
 * Question media orchestration (migration 0242).
 *
 * Attachments are server-managed rows: the upload happens first (purpose `question_media`), then the
 * URL is attached to a saved question. Detaching removes the row first and only then unlinks the file,
 * so a crash can leave an unreferenced file (the sweep's job) but never a dangling reference.
 */
export async function attachQuestionMedia(
  user: User,
  input: { questionId: string } & QuestionAttachmentInput,
): Promise<QuestionAttachment> {
  const tenant = getRequestTenant();
  if (!tenant) throw new NotFoundError("Tenant context required");

  const question = await questionBankRepository.findQuestionById(tenant, input.questionId);
  if (!question) throw new NotFoundError(`Question ${input.questionId} not found`);
  if (question.deletedAt) {
    throw new ValidationError(`Question ${input.questionId} is archived — restore it first`);
  }

  const url = questionMediaUrlFor(tenant, input.url);
  if (!url) {
    throw new ValidationError(
      "Attachment URL must be a question-media upload for the current workspace",
    );
  }
  if (input.kind === "option" && (input.optionIndex ?? -1) < 0) {
    throw new ValidationError("An option attachment needs a non-negative option index");
  }

  if (!questionBankRepository.addQuestionAttachment) {
    throw new NotFoundError("Question media is unavailable");
  }
  const attachment = await questionBankRepository.addQuestionAttachment(tenant, {
    id: `att-${randomUUID()}`,
    questionId: input.questionId,
    kind: input.kind,
    optionIndex: input.kind === "option" ? (input.optionIndex ?? 0) : null,
    name: input.name,
    mime: input.mime,
    size: input.size,
    url,
    actorId: String(user.id),
  });

  await broadcastCollection("questions");
  return attachment;
}

/** Detach media and unlink the file when nothing else references it. */
export async function detachQuestionMedia(
  user: User,
  input: { questionId: string; attachmentId: string },
): Promise<void> {
  const tenant = getRequestTenant();
  if (!tenant) throw new NotFoundError("Tenant context required");

  if (!questionBankRepository.removeQuestionAttachment) {
    throw new NotFoundError("Question media is unavailable");
  }
  const url = await questionBankRepository.removeQuestionAttachment(tenant, {
    ...input,
    actorId: String(user.id),
  });
  const stillReferenced = questionBankRepository.isQuestionAttachmentReferenced
    ? await questionBankRepository.isQuestionAttachmentReferenced(tenant, [url])
    : false;
  if (!stillReferenced) {
    await deleteQuestionMediaFile(tenant, url).catch(() => false);
  }

  await broadcastCollection("questions");
}
