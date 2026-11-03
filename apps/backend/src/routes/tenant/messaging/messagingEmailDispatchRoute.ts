import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import { messagingEmailDispatchSchema } from "@mms/shared";
import { randomUUID } from "node:crypto";
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
  containsExecutableHtml,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";
import { dispatchMessagingCampaignDirect } from "./messagingDirectDispatch.js";
import {
  type MessagingDispatchPayload,
  messagingDispatchBodyDigest,
  resolveIdempotencyKey,
  withMessagingIdempotency,
} from "./messagingLogIdempotency.js";

/** Endpoint to dispatch Email batches directly via the configured tenant SMTP gateway. */
export const messagingEmailDispatchRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", createStrictRateLimitGuard(fastify, MESSAGING_LOG_RATE_LIMIT));

  fastify.post("/dispatch/email", async (req, reply) => {
    const user = req.user as User;
    if (!canWriteMessaging(user)) return sendForbidden(reply);

    const parsed = parseRequest(messagingEmailDispatchSchema, req.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const unknownBodyTokens = collectUnknownPersonalizationTokens(parsed.data.message);
    const unknownSubjectTokens = collectUnknownPersonalizationTokens(parsed.data.subject);
    const allUnknown = [...new Set([...unknownBodyTokens, ...unknownSubjectTokens])];
    if (allUnknown.length > 0) {
      return replyValidationError(reply, formatUnknownTokensMessage(allUnknown));
    }
    if (parsed.data.html && containsExecutableHtml(parsed.data.html)) {
      return replyValidationError(reply, "Executable HTML is not allowed in email messages");
    }

    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }

    const { recipients, subject, message, html, category } = parsed.data;
    const sentAt = new Date().toISOString();
    const userId = String(user.id);
    const idempotencyKey = resolveIdempotencyKey(
      parsed.data.idempotencyKey,
      req.headers["idempotency-key"],
    );
    const bodyDigest = messagingDispatchBodyDigest({
      recipients,
      subject,
      message,
      html: html ?? null,
      category,
    });

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
      const label = `Dispatching Email campaign (${recipients.length} recipients)`;
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
          channel: "email",
          recipients,
          message,
          subject,
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
        dispatchId: idempotencyKey ?? randomUUID(),
        channel: "email",
        recipients,
        message,
        sentAt,
        category,
        subject,
        html,
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
        return sendDatabaseError(reply, "Failed to dispatch email", err);
      }
    }

    return reply.send(await runDispatch());
  });
};
