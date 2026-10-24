import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  isSmsProviderId,
  mergeSmsIntegrationConfig,
  smsIntegrationBodySchema,
  smsTestBodySchema,
} from "@mms/shared";
import {
  loadPlatformSmsIntegrationConfig,
  markPlatformSmsIntegrationTestResult,
  savePlatformSmsIntegrationConfig,
  savePlatformSmsIntegrationSecrets,
} from "../../services/platform/platformSmsIntegrationService.js";
import { verifyPlatformSmsTransport } from "../../services/platform/platformSmsService.js";
import {
  authenticatePlatform,
  requirePlatformPermission,
} from "../../middleware/authenticatePlatform.js";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";

export default async function platformSmsIntegrationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticatePlatform);
  fastify.addHook("preHandler", requirePlatformPermission("settings"));

  const sendLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.get("/integration", async (_request, reply) => {
    const config = await loadPlatformSmsIntegrationConfig();
    return reply.send(config);
  });

  fastify.put("/integration", async (request, reply) => {
    const parsed = parseRequest(smsIntegrationBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const body = parsed.data;

    if (!isSmsProviderId(body.providerId)) {
      return replyValidationError(reply, "Unsupported SMS provider");
    }

    const current = await loadPlatformSmsIntegrationConfig();
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
      await savePlatformSmsIntegrationSecrets({ accountSecret: body.accountSecret.trim() });
      next.hasCredentials = true;
    }

    const saved = await savePlatformSmsIntegrationConfig(next);
    return reply.send(saved);
  });

  fastify.post("/integration/test", { preHandler: sendLimit }, async (request, reply) => {
    const parsed = parseRequest(smsTestBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const testSend = await verifyPlatformSmsTransport(parsed.data.testPhone);
    if (!testSend.sent) {
      await markPlatformSmsIntegrationTestResult(false, testSend.message ?? testSend.reason);
      return replyValidationError(reply, testSend.message ?? "Test SMS could not be sent", {
        reason: testSend.reason,
      });
    }

    const saved = await markPlatformSmsIntegrationTestResult(true);
    return reply.send({ success: true, config: saved });
  });
}
