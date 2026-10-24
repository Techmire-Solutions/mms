import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { User } from "@mms/shared";
import { isWhatsappProviderId, mergeWhatsappIntegrationConfig } from "@mms/shared";
import {
  loadWhatsappIntegrationConfig,
  markWhatsappIntegrationTestResult,
  saveWhatsappIntegrationConfig,
  saveWhatsappIntegrationSecrets,
} from "../../services/whatsapp/whatsappIntegrationService.js";
import { verifyWhatsAppTransport } from "../../services/whatsapp/whatsappService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { canWriteObject } from "../../services/rbacService.js";
import { whatsappIntegrationBodySchema, whatsappTestBodySchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";

export default async function whatsappRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);

  const whatsappSendLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.get("/integration", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "whatsapp_integration")) {
      return sendForbidden(
        reply,
        "Administrator access is required for WhatsApp integration settings",
      );
    }
    const config = await loadWhatsappIntegrationConfig();
    return reply.send(config);
  });

  fastify.put("/integration", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "whatsapp_integration")) {
      return sendForbidden(
        reply,
        "Administrator access is required for WhatsApp integration settings",
      );
    }

    const parsed = parseRequest(whatsappIntegrationBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const body = parsed.data;

    if (!isWhatsappProviderId(body.providerId)) {
      return replyValidationError(reply, "Unsupported WhatsApp provider");
    }

    const current = await loadWhatsappIntegrationConfig();
    const next = mergeWhatsappIntegrationConfig({
      providerId: body.providerId,
      accountId: body.accountId,
      phoneNumberId: body.phoneNumberId,
      senderId: body.senderId,
      apiBaseUrl: body.apiBaseUrl,
      connected: current.connected,
      hasCredentials: current.hasCredentials || Boolean(body.accountSecret?.trim()),
      lastTestAt: current.lastTestAt,
      lastTestOk: current.lastTestOk,
      lastError: current.lastError,
    });

    if (body.accountSecret?.trim()) {
      await saveWhatsappIntegrationSecrets({ accountSecret: body.accountSecret.trim() });
      next.hasCredentials = true;
    }

    const saved = await saveWhatsappIntegrationConfig(next);
    return reply.send(saved);
  });

  fastify.post("/integration/test", { preHandler: whatsappSendLimit }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "whatsapp_integration")) {
      return sendForbidden(
        reply,
        "Administrator access is required for WhatsApp integration settings",
      );
    }

    const parsed = parseRequest(whatsappTestBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const testSend = await verifyWhatsAppTransport(parsed.data.testPhone);
    if (!testSend.sent) {
      await markWhatsappIntegrationTestResult(false, testSend.message ?? testSend.reason);
      return replyValidationError(
        reply,
        testSend.message ?? "Test WhatsApp message could not be sent",
        {
          reason: testSend.reason,
        },
      );
    }

    const saved = await markWhatsappIntegrationTestResult(true);
    return reply.send({ success: true, config: saved });
  });
}
