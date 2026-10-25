import type { FastifyReply, FastifyRequest } from "fastify";
import type { Message, MessageLogCreateDto, User } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { canWriteMessaging } from "../../../services/rbacService.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import {
  collectUnknownPersonalizationTokens,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";
import {
  type MessagingRecordLogsPayload,
  messagingDispatchBodyDigest,
  resolveIdempotencyKey,
  withMessagingIdempotency,
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

/** Records one log batch against the use-case (shared by all idempotency paths). */
async function runRecordMessageLogs(
  user: User,
  tenantSubdomain: string,
  logs: MessageLogCreateDto[],
): Promise<Message[]> {
  const normalized = normalizeDispatchLogs(user, logs);
  return messagingUseCases.recordMessageLogs(tenantSubdomain, normalized);
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

  try {
    if (idempotencyKey) {
      const bodyDigest = messagingDispatchBodyDigest(data.logs);
      const result = await withMessagingIdempotency<MessagingRecordLogsPayload, Message[]>({
        tenantId: tenantSubdomain,
        userId: String(user.id),
        clientKey: idempotencyKey,
        bodyDigest,
        flow: {
          claim: { recorded: null, bodyDigest },
          complete: (recorded) => ({ recorded: recorded.length, bodyDigest }),
          completedBody: (payload) =>
            payload.recorded === null ? null : { recorded: payload.recorded },
          run: () => runRecordMessageLogs(user, tenantSubdomain, data.logs),
        },
      });
      return result;
    }

    const recorded = await runRecordMessageLogs(user, tenantSubdomain, data.logs);
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
