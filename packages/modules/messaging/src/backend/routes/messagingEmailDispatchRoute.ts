import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/contracts";
import { messagingEmailDispatchSchema } from "@mms/contracts";
import { buildBackgroundJobId } from "@mms/be-core/jobs/backgroundJobIds";
import { getRequestTenant } from "@mms/be-core/http";
import { sendDatabaseError, sendForbidden } from "@mms/be-core/http/errors";
import { createStrictRateLimitGuard } from "../deps.js";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { canWriteMessaging } from "@mms/be-core/rbac";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
} from "../deps.js";
import {
  collectUnknownPersonalizationTokens,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";
import { dispatchMessagingCampaignDirect } from "../services/index.js";
import {
  type MessagingDispatchPayload,
  messagingDispatchBodyDigest,
  idempotencyBodyMatches,
  resolveIdempotencyKey,
  withMessagingIdempotency,
} from "./messagingLogIdempotency.js";

/** Endpoint to dispatch Email batches directly via the configured tenant SMTP gateway. */
export const messagingEmailDispatchRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", createStrictRateLimitGuard(fastify));

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

    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }

    const { recipients, subject, message, category } = parsed.data;
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
      subject,
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
        if (!idempotencyBodyMatches({ bodyDigest: existingDigest ?? "" }, bodyDigest)) {
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
          id: dispatchId,
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
        dispatchId,
        channel: "email",
        recipients,
        message,
        sentAt,
        category,
        subject,
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
