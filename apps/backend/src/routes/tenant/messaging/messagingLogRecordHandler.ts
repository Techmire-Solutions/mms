import type { FastifyReply, FastifyRequest } from "fastify";
import type { Message, MessageLogCreateDto, User } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { getRequestTenant } from "../../../lib/tenantContext.js";
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

export function findUnknownLogTokensError(logs: MessageLogCreateDto[]): string | null {
  for (const log of logs) {
    const unknown = collectUnknownPersonalizationTokens(log.body, log.subject);
    if (unknown.length > 0) {
      return formatUnknownTokensMessage(unknown);
    }
  }
  return null;
}

/** Processes message logs recording with idempotency handling. */
export async function processRecordMessageLogs(
  user: User,
  tenantSubdomain: string,
  data: { logs: MessageLogCreateDto[]; idempotencyKey?: string },
  idempotencyHeader?: string,
): Promise<{ status: 200 | 400 | 403 | 409 | 500; body: Record<string, unknown> }> {
  if (!canWriteMessaging(user)) {
    return { status: 403, body: { type: "forbidden", message: "Insufficient permissions" } };
  }
  const tokenError = findUnknownLogTokensError(data.logs);
  if (tokenError) {
    return { status: 400, body: { type: "validation_error", message: tokenError } };
  }

  const idempotencyKey = resolveIdempotencyKey(data.idempotencyKey, idempotencyHeader);
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
          return {
            status: 409,
            body: {
              type: "conflict",
              message: "Idempotency key reused with a different request body",
            },
          };
        }
        const recorded = existing.payload.recorded === null ? undefined : existing.payload.recorded;
        if (recorded !== undefined) {
          return { status: 200, body: { recorded } };
        }
        const waited = await waitForCompletedIdempotency(lookupKey, bodyDigest);
        if (waited && "mismatch" in waited) {
          return {
            status: 409,
            body: {
              type: "conflict",
              message: "Idempotency key reused with a different request body",
            },
          };
        }
        if (waited && "recorded" in waited) {
          return { status: 200, body: { recorded: waited.recorded } };
        }
        return {
          status: 409,
          body: { type: "conflict", message: "Idempotent request still in progress" },
        };
      }

      const claim = await tryClaimAuthArtifactByLookupKey<MessagingIdempotencyPayload>(
        "messaging_idempotency",
        { recorded: null, bodyDigest },
        MESSAGING_IDEMPOTENCY_TTL_MS,
        { lookupKey, scopeKey },
      );
      if (!claim.claimed) {
        const waited = await waitForCompletedIdempotency(lookupKey, bodyDigest);
        if (waited && "mismatch" in waited) {
          return {
            status: 409,
            body: {
              type: "conflict",
              message: "Idempotency key reused with a different request body",
            },
          };
        }
        if (waited && "recorded" in waited) {
          return { status: 200, body: { recorded: waited.recorded } };
        }
        return {
          status: 409,
          body: { type: "conflict", message: "Idempotent request still in progress" },
        };
      }

      try {
        const normalized = normalizeDispatchLogs(user, data.logs);
        const recorded = await messagingUseCases.recordMessageLogs(tenantSubdomain, normalized);
        const payload: MessagingIdempotencyPayload = { recorded: recorded.length, bodyDigest };
        await updateAuthArtifactPayload(claim.id, payload);
        return { status: 200, body: { recorded: recorded.length } };
      } catch (err) {
        await deleteAuthArtifact(claim.id).catch(() => undefined);
        throw err;
      }
    }

    const normalized = normalizeDispatchLogs(user, data.logs);
    const recorded = await messagingUseCases.recordMessageLogs(tenantSubdomain, normalized);
    return { status: 200, body: { recorded: recorded.length } };
  } catch {
    return {
      status: 500,
      body: { type: "database_error", message: "Failed to record message logs" },
    };
  }
}

/** Records dispatch audit logs with optional idempotency claim. */
export async function handleRecordMessageLogs(
  req: FastifyRequest,
  reply: FastifyReply,
  data: { logs: MessageLogCreateDto[]; idempotencyKey?: string },
): Promise<unknown> {
  const user = req.user as User;
  const tenantSubdomain = getRequestTenant();
  if (!tenantSubdomain) {
    return reply.status(400).send({ type: "validation_error", message: "Tenant context required" });
  }
  const result = await processRecordMessageLogs(
    user,
    tenantSubdomain,
    data,
    req.headers["idempotency-key"] as string | undefined,
  );
  return reply.status(result.status).send(result.body);
}
