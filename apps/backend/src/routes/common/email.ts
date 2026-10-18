import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { User } from "@mms/shared";
import { isEmailProviderId, mergeEmailIntegrationConfig } from "@mms/shared";
import {
  loadEmailIntegrationConfig,
  markEmailIntegrationTestResult,
  saveEmailIntegrationConfig,
  saveEmailIntegrationSecrets,
} from "../../services/email/emailIntegrationService.js";
import { sendTenantEmail, verifyEmailTransport } from "../../services/email/emailService.js";
import { loadGlobalSettings } from "../../services/globalSettingsService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { canWriteObject } from "../../services/rbacService.js";
import { emailIntegrationBodySchema, verificationCodeBodySchema } from "@mms/shared";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";

export default async function emailRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);

  // Sending mail is a side-effect with cost and abuse potential — keep it on
  // the strict auth budget rather than the 300/min global default.
  const emailSendLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

  fastify.get("/integration", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "email_integration")) {
      return sendForbidden(
        reply,
        "Administrator access is required for email integration settings",
      );
    }
    const config = await loadEmailIntegrationConfig();
    return reply.send(config);
  });

  fastify.put("/integration", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "email_integration")) {
      return sendForbidden(
        reply,
        "Administrator access is required for email integration settings",
      );
    }

    const parsed = parseRequest(emailIntegrationBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const body = parsed.data;

    if (!isEmailProviderId(body.providerId)) {
      return replyValidationError(reply, "Unsupported email provider");
    }

    const current = await loadEmailIntegrationConfig();
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
      await saveEmailIntegrationSecrets({ smtpPassword: body.smtpPassword.trim() });
      next.hasCredentials = true;
    }

    const saved = await saveEmailIntegrationConfig(next);
    return reply.send(saved);
  });

  fastify.post("/integration/test", async (request, reply) => {
    const user = request.user as User;
    if (!canWriteObject(user, "email_integration")) {
      return sendForbidden(
        reply,
        "Administrator access is required for email integration settings",
      );
    }

    const verify = await verifyEmailTransport();
    if (!verify.sent) {
      await markEmailIntegrationTestResult(false, verify.message ?? verify.reason);
      return replyValidationError(reply, verify.message ?? "Email is not configured", {
        reason: verify.reason,
      });
    }

    const settings = await loadGlobalSettings();
    const testSend = await sendTenantEmail(
      {
        to: user.email,
        subject: "MMS email test",
        text: "Your madrasa workspace email integration is working.",
      },
      settings,
    );

    if (!testSend.sent) {
      await markEmailIntegrationTestResult(false, testSend.message ?? testSend.reason);
      return replyValidationError(reply, testSend.message ?? "Test email could not be sent", {
        reason: testSend.reason,
      });
    }

    const saved = await markEmailIntegrationTestResult(true);
    return reply.send({ success: true, config: saved });
  });

  fastify.post("/verification-code", { preHandler: emailSendLimit }, async (request, reply) => {
    const user = request.user as User;
    const parsed = parseRequest(verificationCodeBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const { code } = parsed.data;

    const settings = await loadGlobalSettings();
    const result = await sendTenantEmail(
      {
        to: user.email,
        subject: "MMS verification code",
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
      },
      settings,
    );

    if (!result.sent) {
      return replyValidationError(reply, result.message ?? "Verification email could not be sent", {
        reason: result.reason,
        delivered: false,
      });
    }

    return reply.send({ delivered: true, channel: "email" });
  });
}
