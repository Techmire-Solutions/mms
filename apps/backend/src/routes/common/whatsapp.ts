import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type {
  User,
  WhatsappIntegrationConfig,
  WhatsappIntegrationSecrets,
  WhatsappProviderId,
} from "@mms/shared";
import {
  isWhatsappProviderId,
  mergeWhatsappIntegrationConfig,
  whatsappIntegrationBodySchema,
  whatsappTestBodySchema,
} from "@mms/shared";
import {
  loadWhatsappIntegrationConfig,
  markWhatsappIntegrationTestResult,
  saveWhatsappIntegrationConfig,
  saveWhatsappIntegrationSecrets,
} from "../../services/whatsapp/whatsappIntegrationService.js";
import { verifyWhatsAppTransport } from "../../services/whatsapp/whatsappService.js";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { canWriteObject } from "../../services/rbacService.js";
import { sendForbidden } from "../../lib/httpErrors.js";
import { registerIntegrationRoutes } from "../../lib/registerIntegrationRoutes.js";

interface WhatsappIntegrationPutBody {
  providerId: string;
  accountId?: string;
  phoneNumberId?: string;
  senderId: string;
  apiBaseUrl?: string;
  accountSecret?: string;
}

interface WhatsappTestBody {
  testPhone: string;
}

export default async function whatsappRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  registerIntegrationRoutes<
    WhatsappIntegrationConfig,
    WhatsappIntegrationSecrets,
    WhatsappIntegrationPutBody,
    WhatsappTestBody
  >(
    fastify,
    {
      integrationBodySchema: whatsappIntegrationBodySchema,
      testBodySchema: whatsappTestBodySchema,
      isProviderId: isWhatsappProviderId,
      unsupportedProviderMessage: "Unsupported WhatsApp provider",
      load: loadWhatsappIntegrationConfig,
      save: saveWhatsappIntegrationConfig,
      saveSecrets: saveWhatsappIntegrationSecrets,
      buildNext: (current, body) =>
        mergeWhatsappIntegrationConfig({
          // Guarded by isWhatsappProviderId in the shared registry.
          providerId: body.providerId as WhatsappProviderId,
          accountId: body.accountId,
          phoneNumberId: body.phoneNumberId,
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
        const result = await verifyWhatsAppTransport(body.testPhone);
        return {
          sent: result.sent,
          reason: result.reason,
          markMessage: result.message,
          replyMessage: result.message,
        };
      },
      markTestResult: markWhatsappIntegrationTestResult,
      authGate: (request, reply) => {
        const user = request.user as User;
        if (!canWriteObject(user, "whatsapp_integration")) {
          sendForbidden(
            reply,
            "Administrator access is required for WhatsApp integration settings",
          );
          return false;
        }
        return true;
      },
      testFailureMessage: "Test WhatsApp message could not be sent",
    },
    (instance) => instance.addHook("preHandler", authenticateTenant),
  );
}
