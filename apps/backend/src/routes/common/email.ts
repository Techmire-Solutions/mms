import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type {
  EmailIntegrationConfig,
  EmailIntegrationSecrets,
  EmailProviderId,
  User,
} from "@mms/shared";
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
import {
  emailIntegrationBodySchema,
  emailTestBodySchema,
  verificationCodeBodySchema,
} from "@mms/shared";
import { parseRequest, replyValidationError } from "../../lib/zodRequest.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { AUTH_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../lib/rateLimitGuard.js";
import { registerIntegrationRoutes } from "../../lib/registerIntegrationRoutes.js";

interface EmailIntegrationPutBody {
  providerId: string;
  fromAddress: string;
  fromName?: string;
  smtpUsername: string;
  smtpPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

interface EmailTestBody {
  testEmail?: string;
}

export default async function emailRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  registerIntegrationRoutes<
    EmailIntegrationConfig,
    EmailIntegrationSecrets,
    EmailIntegrationPutBody,
    EmailTestBody
  >(
    fastify,
    {
      integrationBodySchema: emailIntegrationBodySchema,
      testBodySchema: emailTestBodySchema,
      isProviderId: isEmailProviderId,
      unsupportedProviderMessage: "Unsupported email provider",
      load: loadEmailIntegrationConfig,
      save: saveEmailIntegrationConfig,
      saveSecrets: saveEmailIntegrationSecrets,
      buildNext: (current, body) =>
        mergeEmailIntegrationConfig({
          // Guarded by isEmailProviderId in the shared registry.
          providerId: body.providerId as EmailProviderId,
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
        }),
      secretFromBody: (body) => body.smtpPassword?.trim() || undefined,
      secretsFromSecret: (secret) => ({ smtpPassword: secret }),
      testSend: async (request, body) => {
        const user = request.user as User;
        const testEmail = body.testEmail?.trim() || user.email;

        const verify = await verifyEmailTransport();
        if (!verify.sent) {
          return {
            sent: false,
            reason: verify.reason,
            markMessage: verify.message,
            replyMessage: verify.message ?? "Email is not configured",
          };
        }

        const settings = await loadGlobalSettings();
        const result = await sendTenantEmail(
          {
            to: testEmail,
            subject: "MMS email test",
            text: "Your madrasa workspace email integration is working.",
          },
          settings,
        );
        if (!result.sent) {
          return {
            sent: false,
            reason: result.reason,
            markMessage: result.message,
            replyMessage: result.message ?? "Test email could not be sent",
          };
        }
        return { sent: true };
      },
      markTestResult: markEmailIntegrationTestResult,
      authGate: (request, reply) => {
        const user = request.user as User;
        if (!canWriteObject(user, "email_integration")) {
          sendForbidden(reply, "Administrator access is required for email integration settings");
          return false;
        }
        return true;
      },
      testFailureMessage: "Test email could not be sent",
    },
    (instance) => instance.addHook("preHandler", authenticateTenant),
  );

  // Non-integration route — sending a verification code stays on the strict
  // auth budget rather than the 300/min global default.
  const emailSendLimit = createStrictRateLimitGuard(fastify, AUTH_RATE_LIMIT);

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
