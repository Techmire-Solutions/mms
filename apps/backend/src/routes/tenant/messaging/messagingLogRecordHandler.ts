import type { FastifyReply, FastifyRequest } from "fastify";
import type { Message, MessageLogCreateDto, User } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { replyValidationError } from "../../../lib/zodRequest.js";
import { canWriteMessaging } from "../../../services/rbacService.js";
import {
  authArtifactUserScopeKey,
  authArtifactWorkspaceScopeKey,
  deleteAuthArtifact,
  findAuthArtifactByLookupKey,
  tryClaimAuthArtifactByLookupKey,
  updateAuthArtifactPayload,
} from "../../../services/auth/authArtifactService.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import {
  collectUnknownPersonalizationTokens,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";
import {
  MESSAGING_IDEMPOTENCY_TTL_MS,
  type MessagingIdempotencyPayload,
  idempotencyBodyMatches,
  messagingDispatchBodyDigest,
  messagingIdempotencyLookupKey,
  replyIdempotencyBodyMismatch,
  resolveIdempotencyKey,
  waitForCompletedIdempotency,
} from "./messagingLogIdempotency.js";

function normalizeDispatchLogs(user: User, logs: MessageLogCreateDto[]): Message[] {
  const sentAt = new Date().toISOString();
  return logs.map((log) => ({
    id: randomUUID(),
    userId: user.id,
    contactId: log.contactId,
    channel: log.channel,
    body: log.body,
    sentAt,
    status: log.status || "sent",
    subject: log.subject,
    category: log.category || "general",
    errorMessage: log.errorMessage,
  }));
}

function rejectUnknownLogTokens(
  reply: FastifyReply,
  logs: MessageLogCreateDto[],
): ReturnType<typeof replyValidationError> | undefined {
  for (const log of logs) {
    const unknown = collectUnknownPersonalizationTokens(log.body, log.subject);
    if (unknown.length > 0) {
      return replyValidationError(reply, formatUnknownTokensMessage(unknown));
    }
  }
  return undefined;
}

/** Records dispatch audit logs with optional idempotency claim. */
export async function handleRecordMessageLogs(
  req: FastifyRequest,
  reply: FastifyReply,
  data: { logs: MessageLogCreateDto[]; idempotencyKey?: string },
): Promise<unknown> {
  const user = req.user as User;
  if (!canWriteMessaging(user)) return sendForbidden(reply);
  const tokenRejection = rejectUnknownLogTokens(reply, data.logs);
  if (tokenRejection) return tokenRejection;
  const tenantSubdomain = getRequestTenant();
  if (!tenantSubdomain) {
    return reply.status(400).send({ type: "validation_error", message: "Tenant context required" });
  }

  const idempotencyKey = resolveIdempotencyKey(data.idempotencyKey, req.headers["idempotency-key"]);
  const bodyDigest = messagingDispatchBodyDigest(data.logs);
  const lookupKey = idempotencyKey
    ? messagingIdempotencyLookupKey(tenantSubdomain, user.id, idempotencyKey)
    : undefined;
  const scopeKey = `${authArtifactWorkspaceScopeKey(tenantSubdomain)}:${authArtifactUserScopeKey(user.id)}`;

  try {
    if (lookupKey) {
      const existing = await findAuthArtifactByLookupKey<MessagingIdempotencyPayload>(
        "messaging_idempotency",
        lookupKey,
      );
      if (existing) {
        if (!idempotencyBodyMatches(existing.payload, bodyDigest)) {
          return replyIdempotencyBodyMismatch(reply);
        }
        const recorded = existing.payload.recorded === null ? undefined : existing.payload.recorded;
        if (recorded !== undefined) {
          return reply.send({ recorded });
        }
        const waited = await waitForCompletedIdempotency(lookupKey, bodyDigest);
        if (waited && "mismatch" in waited) return replyIdempotencyBodyMismatch(reply);
        if (waited && "recorded" in waited) return reply.send({ recorded: waited.recorded });
        return reply.status(409).send({
          type: "conflict",
          message: "Idempotent request still in progress",
        });
      }

      const claim = await tryClaimAuthArtifactByLookupKey<MessagingIdempotencyPayload>(
        "messaging_idempotency",
        { recorded: null, bodyDigest },
        MESSAGING_IDEMPOTENCY_TTL_MS,
        { lookupKey, scopeKey },
      );
      if (!claim.claimed) {
        const waited = await waitForCompletedIdempotency(lookupKey, bodyDigest);
        if (waited && "mismatch" in waited) return replyIdempotencyBodyMismatch(reply);
        if (waited && "recorded" in waited) return reply.send({ recorded: waited.recorded });
        return reply.status(409).send({
          type: "conflict",
          message: "Idempotent request still in progress",
        });
      }

      try {
        const normalized = normalizeDispatchLogs(user, data.logs);
        const recorded = await messagingUseCases.recordMessageLogs(tenantSubdomain, normalized);
        const payload: MessagingIdempotencyPayload = { recorded: recorded.length, bodyDigest };
        await updateAuthArtifactPayload(claim.id, payload);
        return reply.send({ recorded: recorded.length });
      } catch (err) {
        await deleteAuthArtifact(claim.id).catch(() => undefined);
        throw err;
      }
    }

    const normalized = normalizeDispatchLogs(user, data.logs);
    const recorded = await messagingUseCases.recordMessageLogs(tenantSubdomain, normalized);
    return reply.send({ recorded: recorded.length });
  } catch (err) {
    return sendDatabaseError(reply, "Failed to record message logs", err);
  }
}
