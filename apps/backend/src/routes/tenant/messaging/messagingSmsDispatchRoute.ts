import type { FastifyPluginAsync } from "fastify";
import type { Message, User } from "@mms/shared";
import { messagingSmsDispatchSchema, personalizeMessage } from "@mms/shared";
import { randomUUID } from "node:crypto";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { MESSAGING_LOG_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { canWriteMessaging } from "../../../services/rbacService.js";
import { sendTenantSms } from "../../../services/sms/smsService.js";
import { enqueueBackgroundJob } from "../../../services/backgroundJobWorkerService.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import {
  collectUnknownPersonalizationTokens,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";

/** Endpoint to dispatch SMS batches directly via the configured tenant SMS gateway. */
export const messagingSmsDispatchRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", createStrictRateLimitGuard(fastify, MESSAGING_LOG_RATE_LIMIT));

  fastify.post("/dispatch/sms", async (req, reply) => {
    const user = req.user as User;
    if (!canWriteMessaging(user)) return sendForbidden(reply);

    const parsed = parseRequest(messagingSmsDispatchSchema, req.body);
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

    const isQueued =
      recipients.length > 50 || Boolean((req.body as Record<string, unknown>)?.queued);
    if (isQueued) {
      const jobId = randomUUID();
      const label = `Dispatching SMS campaign (${recipients.length} recipients)`;
      const job = await enqueueBackgroundJob(
        tenantSubdomain,
        String(user.id),
        {
          id: jobId,
          moduleId: "messaging",
          kind: "dispatch",
          status: "running",
          label,
          createdAt: sentAt,
        },
        {
          channel: "sms",
          recipients,
          message,
          category,
        },
      );
      return reply.status(202).send({
        queued: true,
        job,
        total: recipients.length,
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const logs: Message[] = [];

    for (const recipient of recipients) {
      const personalizedBody = personalizeMessage(message, recipient);
      try {
        const sendResult = await sendTenantSms({
          to: recipient.phone,
          body: personalizedBody,
        });

        if (sendResult.sent) {
          sentCount++;
          logs.push({
            id: randomUUID(),
            userId: user.id,
            contactId: recipient.id,
            channel: "sms",
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
            channel: "sms",
            body: personalizedBody,
            sentAt,
            status: "failed",
            category,
            errorMessage:
              sendResult.message || sendResult.reason || "SMS gateway rejected dispatch",
          });
        }
      } catch (err) {
        failedCount++;
        logs.push({
          id: randomUUID(),
          userId: user.id,
          contactId: recipient.id,
          channel: "sms",
          body: personalizedBody,
          sentAt,
          status: "failed",
          category,
          errorMessage: err instanceof Error ? err.message : "SMS dispatch error",
        });
      }
    }

    try {
      if (logs.length > 0) {
        await messagingUseCases.recordMessageLogs(tenantSubdomain, logs);
      }
      return reply.send({
        sentCount,
        failedCount,
        total: recipients.length,
      });
    } catch (err) {
      return sendDatabaseError(reply, "Failed to record dispatched SMS logs", err);
    }
  });
};
