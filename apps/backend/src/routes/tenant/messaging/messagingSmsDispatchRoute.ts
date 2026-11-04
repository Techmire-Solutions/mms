import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { messagingSmsDispatchSchema } from "@mms/shared";
import { buildBackgroundJobId } from "../../../lib/backgroundJobIds.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { MESSAGING_LOG_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { canWriteMessaging } from "../../../services/rbacService.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
} from "../../../services/backgroundJobWorkerService.js";
import {
  collectUnknownPersonalizationTokens,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";
import { dispatchMessagingCampaignDirect } from "./messagingDirectDispatch.js";
import {
  type MessagingDispatchPayload,
  messagingDispatchBodyDigest,
  resolveIdempotencyKey,
  withMessagingIdempotency,
} from "./messagingLogIdempotency.js";

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
    const userId = String(user.id);
    const idempotencyKey = resolveIdempotencyKey(
      parsed.data.idempotencyKey,
      req.headers["idempotency-key"],
    );
    const isQueued = recipients.length > 50 || parsed.data.queued === true;
    // The execution mode is part of both the digest and the delivery-claim
    // namespace (`dispatchId`): a retry that flips a campaign between the queued
    // and direct paths must collide with the other path's per-recipient claim,
    // not re-message everyone.
    const bodyDigest = messagingDispatchBodyDigest({
      recipients,
      message,
      category,
      queued: isQueued,
    });
    const dispatchId = buildBackgroundJobId(tenantSubdomain, userId, idempotencyKey);

    if (isQueued) {
      // Queued path dedupe mirrors messagingExportRoutes: the client key (if
      // any) becomes the job id and a digest of the dispatch body is stored in
      // the payload so retries replay or 409 instead of double-dispatching.
      const existing = await getUserBackgroundJob(userId, dispatchId);
      if (existing) {
        const payload = await getUserBackgroundJobPayload(userId, dispatchId);
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
      const label = `Dispatching SMS campaign (${recipients.length} recipients)`;
      const job = await enqueueBackgroundJob(
        tenantSubdomain,
        userId,
        {
          id: dispatchId,
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

    const runDispatch = () =>
      dispatchMessagingCampaignDirect({
        tenantSubdomain,
        userId,
        dispatchId,
        channel: "sms",
        recipients,
        message,
        sentAt,
        category,
      });

    if (idempotencyKey) {
      try {
        const result = await withMessagingIdempotency<
          MessagingDispatchPayload,
          Awaited<ReturnType<typeof runDispatch>>
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
        if (result.replayed) reply.header("Idempotency-Replay", "true");
        return reply.status(result.status).send(result.body);
      } catch (err) {
        return sendDatabaseError(reply, "Failed to dispatch SMS", err);
      }
    }

    return reply.send(await runDispatch());
  });
};
