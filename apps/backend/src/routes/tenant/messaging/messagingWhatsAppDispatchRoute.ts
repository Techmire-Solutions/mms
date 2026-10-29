import type { FastifyPluginAsync } from "fastify";
import type { Message, User } from "@mms/shared";
import { messagingWhatsAppDispatchSchema, personalizeMessage } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { buildBackgroundJobId } from "../../../lib/backgroundJobIds.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { MESSAGING_LOG_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { canWriteMessaging } from "../../../services/rbacService.js";
import { sendTenantWhatsApp } from "../../../services/whatsapp/whatsappService.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
} from "../../../services/backgroundJobWorkerService.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import {
  collectUnknownPersonalizationTokens,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";
import {
  type MessagingDispatchPayload,
  type MessagingDispatchSummary,
  messagingDispatchBodyDigest,
  resolveIdempotencyKey,
  withMessagingIdempotency,
} from "./messagingLogIdempotency.js";

/** Endpoint to dispatch WhatsApp batches directly via the configured tenant WhatsApp gateway. */
export const messagingWhatsAppDispatchRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", createStrictRateLimitGuard(fastify, MESSAGING_LOG_RATE_LIMIT));

  fastify.post("/dispatch/whatsapp", async (req, reply) => {
    const user = req.user as User;
    if (!canWriteMessaging(user)) return sendForbidden(reply);

    const parsed = parseRequest(messagingWhatsAppDispatchSchema, req.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const unknownTokens = collectUnknownPersonalizationTokens(parsed.data.message);
    if (unknownTokens.length > 0) {
      return replyValidationError(reply, formatUnknownTokensMessage(unknownTokens));
    }

    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }

    const { recipients, message, category } = parsed.data;
    const sentAt = new Date().toISOString();
    const userId = String(user.id);
    const idempotencyKey = resolveIdempotencyKey(parsed.data.idempotencyKey, undefined);
    const bodyDigest = messagingDispatchBodyDigest({ recipients, message, category });

    const isQueued =
      recipients.length > 50 || Boolean((req.body as Record<string, unknown>)?.queued);
    if (isQueued) {
      // Queued path dedupe mirrors messagingExportRoutes: the client key (if
      // any) becomes the job id and a digest of the dispatch body is stored in
      // the payload so retries replay or 409 instead of double-dispatching.
      const jobId = buildBackgroundJobId(tenantSubdomain, userId, idempotencyKey);
      const existing = await getUserBackgroundJob(userId, jobId);
      if (existing) {
        const payload = await getUserBackgroundJobPayload(userId, jobId);
        const existingDigest =
          typeof payload?.bodyDigest === "string" ? payload.bodyDigest : undefined;
        if (!existingDigest || existingDigest !== bodyDigest) {
          return reply.status(409).send({
            type: "conflict",
            message: "Idempotency key reused with a different dispatch body",
          });
        }
        return reply.status(202).send({
          queued: true,
          job: existing,
          total: recipients.length,
        });
      }
      const label = `Dispatching WhatsApp campaign (${recipients.length} recipients)`;
      const job = await enqueueBackgroundJob(
        tenantSubdomain,
        userId,
        {
          id: jobId,
          moduleId: "messaging",
          kind: "dispatch",
          status: "running",
          label,
          createdAt: sentAt,
        },
        {
          channel: "whatsapp",
          recipients,
          message,
          category,
          idempotencyKey,
          bodyDigest,
        },
      );
      return reply.status(202).send({
        queued: true,
        job,
        total: recipients.length,
      });
    }

    const runDispatch = async (): Promise<MessagingDispatchSummary> => {
      let sentCount = 0;
      let failedCount = 0;
      const logs: Message[] = [];

      for (const recipient of recipients) {
        const personalizedBody = personalizeMessage(message, recipient);
        try {
          const sendResult = await sendTenantWhatsApp({
            to: recipient.phone,
            body: personalizedBody,
          });

          if (sendResult.sent) {
            sentCount++;
            logs.push({
              id: randomUUID(),
              userId: user.id,
              contactId: recipient.id,
              channel: "whatsapp",
              body: personalizedBody,
              sentAt,
              status: "sent",
              category,
            });
          } else {
            failedCount++;
            logs.push({
              id: randomUUID(),
              userId: user.id,
              contactId: recipient.id,
              channel: "whatsapp",
              body: personalizedBody,
              sentAt,
              status: "failed",
              category,
              errorMessage:
                sendResult.message || sendResult.reason || "WhatsApp gateway rejected dispatch",
            });
          }
        } catch (err) {
          failedCount++;
          logs.push({
            id: randomUUID(),
            userId: user.id,
            contactId: recipient.id,
            channel: "whatsapp",
            body: personalizedBody,
            sentAt,
            status: "failed",
            category,
            errorMessage: err instanceof Error ? err.message : "WhatsApp dispatch error",
          });
        }
      }

      if (logs.length > 0) {
        await messagingUseCases.recordMessageLogs(tenantSubdomain, logs);
      }
      return { sentCount, failedCount, total: recipients.length };
    };

    const finishDispatch = async (summary: MessagingDispatchSummary): Promise<unknown> =>
      reply.send(summary);

    if (idempotencyKey) {
      try {
        const result = await withMessagingIdempotency<
          MessagingDispatchPayload,
          MessagingDispatchSummary
        >({
          tenantId: tenantSubdomain,
          userId,
          clientKey: idempotencyKey,
          bodyDigest,
          flow: {
            claim: { response: null, bodyDigest },
            complete: (summary) => ({ response: summary, bodyDigest }),
            completedBody: (payload) => (payload.response ? { ...payload.response } : null),
            run: runDispatch,
          },
        });
        return reply.status(result.status).send(result.body);
      } catch (err) {
        return sendDatabaseError(reply, "Failed to dispatch WhatsApp", err);
      }
    }

    return finishDispatch(await runDispatch());
  });
};
