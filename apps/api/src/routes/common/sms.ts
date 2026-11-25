import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type {
  SmsIntegrationConfig,
  SmsIntegrationSecrets,
  SmsProviderId,
  User,
} from "@mms/contracts";
import {
  isSmsProviderId,
  mergeSmsIntegrationConfig,
  smsIntegrationBodySchema,
  smsTestBodySchema,
} from "@mms/contracts";
import {
  loadSmsIntegrationConfig,
  markSmsIntegrationTestResult,
  saveSmsIntegrationConfig,
  saveSmsIntegrationSecrets,
} from "../../services/sms/smsIntegrationService.js";
import { verifySmsTransport } from "../../services/sms/smsService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { canWriteObject } from "../../services/rbacService.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { registerIntegrationRoutes } from "../../lib/registerIntegrationRoutes.js";

interface SmsIntegrationPutBody {
  providerId: string;
  accountId?: string;
  senderId: string;
  apiBaseUrl?: string;
  accountSecret?: string;
}

interface SmsTestBody {
  testPhone: string;
}

export default async function smsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  registerIntegrationRoutes<
    SmsIntegrationConfig,
    SmsIntegrationSecrets,
    SmsIntegrationPutBody,
    SmsTestBody
  >(
    fastify,
    {
      integrationBodySchema: smsIntegrationBodySchema,
      testBodySchema: smsTestBodySchema,
      isProviderId: isSmsProviderId,
      unsupportedProviderMessage: "Unsupported SMS provider",
      load: loadSmsIntegrationConfig,
      save: saveSmsIntegrationConfig,
      saveSecrets: saveSmsIntegrationSecrets,
      buildNext: (current, body) =>
        mergeSmsIntegrationConfig({
          // Guarded by isSmsProviderId in the shared registry.
          providerId: body.providerId as SmsProviderId,
          accountId: body.accountId,
          senderId: body.senderId,
          apiBaseUrl: body.apiBaseUrl,
          connected: current.connected,
          hasCredentials: current.hasCredentials || Boolean(body.accountSecret?.trim()),
          lastTestAt: current.lastTestAt,
          lastTestOk: current.lastTestOk,
          lastError: current.lastError,
        }),
      secretFromBody: (body) => body.accountSecret?.trim() || undefined,
      secretsFromSecret: (secret) => ({ accountSecret: secret }),
      testSend: async (_request, body) => {
        const result = await verifySmsTransport(body.testPhone);
        return {
          sent: result.sent,
          reason: result.reason,
          markMessage: result.message,
          replyMessage: result.message,
        };
      },
      markTestResult: markSmsIntegrationTestResult,
      authGate: (request, reply) => {
        const user = request.user as User;
        if (!canWriteObject(user, "sms_integration")) {
          sendForbidden(reply, "Administrator access is required for SMS integration settings");
          return false;
        }
        return true;
      },
      testFailureMessage: "Test SMS could not be sent",
    },
    (instance) => instance.addHook("preHandler", authenticateTenant),
  );
}
