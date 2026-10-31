import type { FastifyPluginAsync } from "fastify";
import {
  executeErasureBodySchema,
  retentionEvaluateBodySchema,
  roleHasPermission,
  type User,
} from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendBadRequest, sendForbidden } from "../../../lib/httpErrors.js";
import {
  evaluateAuditRetentionPolicy,
  purgeExpiredCryptoShreddingKeys,
} from "../../../services/auditRetentionService.js";
import { executeSubjectErasure } from "../../../services/cryptoShreddingService.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

export const auditPrivacyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/audit/erasure - Privacy / right-to-erasure GDPR execution.
   * Irreversible: requires `audit.manage` plus a step-up header naming the subject.
   */
  fastify.post("/api/audit/erasure", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "audit.manage")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }

    const parsedBody = parseRequest(executeErasureBodySchema, request.body);
    if (!parsedBody.ok) {
      return replyValidationError(reply, parsedBody.message);
    }
    const body = parsedBody.data;
    const confirmation = String(request.headers["x-confirm-erasure"] ?? "").trim();
    if (confirmation !== body.subjectId) {
      return sendBadRequest(
        reply,
        "Set the X-Confirm-Erasure header to the exact subject id to confirm this irreversible action",
      );
    }

    const userId = (request.user as User | undefined)?.id || "system";

    const result = await executeSubjectErasure({
      subjectId: body.subjectId,
      workspaceSubdomain: tenant,
      regime: body.regime,
      erasureType: body.erasureType,
      requestedBy: userId,
      reason: body.reason,
    });

    if (result.status === "NO_KEY") {
      return reply.status(409).send({
        type: "conflict",
        code: "NO_KEY",
        message: result.message,
      });
    }

    return reply.send(result);
  });

  /**
   * POST /api/audit/retention/evaluate - Section 4: Regulatory regime retention evaluation & automated purge.
   */
  fastify.post("/api/audit/retention/evaluate", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "audit.manage")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }

    const parsedBody = parseRequest(retentionEvaluateBodySchema, request.body);
    if (!parsedBody.ok) {
      return replyValidationError(reply, parsedBody.message);
    }

    const { regime, dryRun } = parsedBody.data;
    if (dryRun) {
      const evaluation = await evaluateAuditRetentionPolicy(regime, tenant);
      return reply.send(evaluation);
    }

    const purgeResult = await purgeExpiredCryptoShreddingKeys({ regime, dryRun: false }, tenant);
    return reply.send(purgeResult);
  });
};
