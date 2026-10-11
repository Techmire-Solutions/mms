import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { User } from "@mms/shared";
import { isSmsProviderId, mergeSmsIntegrationConfig } from "@mms/shared";
import {
  loadSmsIntegrationConfig,
  markSmsIntegrationTestResult,
  saveSmsIntegrationConfig,
  saveSmsIntegrationSecrets,
} from "../../services/sms/smsIntegrationService.js";
import { verifySmsTransport } from "../../services/sms/smsService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { canWriteObject } from "../../services/rbacService.js";
import { smsIntegrationBodySchema, smsTestBodySchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";

export default async function smsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);

  // Sending SMS is a side-effect with real per-message cost and abuse potential —
  // keep it on the strict auth budget rather than the 300/min global default.
  const smsSendLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.get("/integration", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "sms_integration")) {
      return sendForbidden(reply, "Administrator access is required for SMS integration settings");
    }
    const config = await loadSmsIntegrationConfig();
    return reply.send(config);
  });

  fastify.put("/integration", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "sms_integration")) {
      return sendForbidden(reply, "Administrator access is required for SMS integration settings");
    }

    const parsed = parseRequest(smsIntegrationBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const body = parsed.data;

    if (!isSmsProviderId(body.providerId)) {
      return replyValidationError(reply, "Unsupported SMS provider");
    }

    const current = await loadSmsIntegrationConfig();
    const next = mergeSmsIntegrationConfig({
      providerId: body.providerId,
      accountId: body.accountId,
      senderId: body.senderId,
      apiBaseUrl: body.apiBaseUrl,
      connected: current.connected,
      hasCredentials: current.hasCredentials || Boolean(body.accountSecret?.trim()),
      lastTestAt: current.lastTestAt,
      lastTestOk: current.lastTestOk,
      lastError: current.lastError,
    });

    if (body.accountSecret?.trim()) {
      await saveSmsIntegrationSecrets({ accountSecret: body.accountSecret.trim() });
      next.hasCredentials = true;
    }

    const saved = await saveSmsIntegrationConfig(next);
    return reply.send(saved);
  });

  fastify.post("/integration/test", { preHandler: smsSendLimit }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "sms_integration")) {
      return sendForbidden(reply, "Administrator access is required for SMS integration settings");
    }

    const parsed = parseRequest(smsTestBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const testSend = await verifySmsTransport(parsed.data.testPhone);
    if (!testSend.sent) {
      await markSmsIntegrationTestResult(false, testSend.message ?? testSend.reason);
      return replyValidationError(reply, testSend.message ?? "Test SMS could not be sent", {
        reason: testSend.reason,
      });
    }

    const saved = await markSmsIntegrationTestResult(true);
    return reply.send({ success: true, config: saved });
  });
}
