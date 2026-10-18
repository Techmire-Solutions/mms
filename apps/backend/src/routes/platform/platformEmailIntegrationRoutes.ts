import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  isEmailProviderId,
  mergeEmailIntegrationConfig,
  emailIntegrationBodySchema,
} from "@mms/shared";
import {
  loadPlatformEmailIntegrationConfig,
  markPlatformEmailIntegrationTestResult,
  savePlatformEmailIntegrationConfig,
  savePlatformEmailIntegrationSecrets,
} from "../../services/platform/platformEmailIntegrationService.js";
import {
  sendPlatformEmail,
  verifyPlatformEmailTransport,
} from "../../services/platform/platformEmailService.js";
import {
  authenticatePlatform,
  requirePlatformPermission,
  type PlatformAuthenticatedRequest,
} from "../../middleware/authenticatePlatform.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";

export default async function platformEmailIntegrationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticatePlatform);
  fastify.addHook("preHandler", requirePlatformPermission("settings"));

  const sendLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.get("/integration", async (_request, reply) => {
    const config = await loadPlatformEmailIntegrationConfig();
    return reply.send(config);
  });

  fastify.put("/integration", async (request, reply) => {
    const parsed = parseRequest(emailIntegrationBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const body = parsed.data;

    if (!isEmailProviderId(body.providerId)) {
      return replyValidationError(reply, "Unsupported email provider");
    }

    const current = await loadPlatformEmailIntegrationConfig();
    const next = mergeEmailIntegrationConfig({
      providerId: body.providerId,
      fromAddress: body.fromAddress,
      fromName: body.fromName,
      smtpUsername: body.smtpUsername,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpSecure: body.smtpSecure,
      connected: current.connected,
      hasCredentials: current.hasCredentials || Boolean(body.smtpPassword?.trim()),
      lastTestAt: current.lastTestAt,
      lastTestOk: current.lastTestOk,
      lastError: current.lastError,
    });

    if (body.smtpPassword?.trim()) {
      await savePlatformEmailIntegrationSecrets({ smtpPassword: body.smtpPassword.trim() });
      next.hasCredentials = true;
    }

    const saved = await savePlatformEmailIntegrationConfig(next);
    return reply.send(saved);
  });

  fastify.post("/integration/test", { preHandler: sendLimit }, async (request, reply) => {
    const verify = await verifyPlatformEmailTransport();
    if (!verify.sent) {
      await markPlatformEmailIntegrationTestResult(false, verify.message ?? verify.reason);
      return replyValidationError(reply, verify.message ?? "Email is not configured", {
        reason: verify.reason,
      });
    }

    const { platformUser } = request as PlatformAuthenticatedRequest;
    const testSend = await sendPlatformEmail({
      to: platformUser.email,
      subject: "MMS platform email test",
      text: "Your MMS platform email integration is working.",
    });

    if (!testSend.sent) {
      await markPlatformEmailIntegrationTestResult(false, testSend.message ?? testSend.reason);
      return replyValidationError(reply, testSend.message ?? "Test email could not be sent", {
        reason: testSend.reason,
      });
    }

    const saved = await markPlatformEmailIntegrationTestResult(true);
    return reply.send({ success: true, config: saved });
  });
}
