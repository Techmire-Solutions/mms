import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { SmsIntegrationConfig, SmsIntegrationSecrets, SmsProviderId } from "@mms/contracts";
import {
  isSmsProviderId,
  mergeSmsIntegrationConfig,
  smsIntegrationBodySchema,
  smsTestBodySchema,
} from "@mms/contracts";
import {
  loadPlatformSmsIntegrationConfig,
  markPlatformSmsIntegrationTestResult,
  savePlatformSmsIntegrationConfig,
  savePlatformSmsIntegrationSecrets,
} from "../services/platformSmsIntegrationService.js";
import { verifyPlatformSmsTransport } from "../services/platformSmsService.js";
import { authenticatePlatform, requirePlatformPermission } from "../deps.js";
import { insertPlatformActivityLog } from "../use-cases/platformUseCases.js";
import { registerIntegrationRoutes } from "../deps.js";

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

export default async function platformSmsIntegrationRoutes(
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
      load: loadPlatformSmsIntegrationConfig,
      save: savePlatformSmsIntegrationConfig,
      saveSecrets: savePlatformSmsIntegrationSecrets,
      buildNext: (current: any, body: any) =>
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
      secretFromBody: (body: any) => body.accountSecret?.trim() || undefined,
      secretsFromSecret: (secret: any) => ({ accountSecret: secret }),
      testSend: async (_request: any, body: any) => {
        const result = await verifyPlatformSmsTransport(body.testPhone);
        return {
          sent: result.sent,
          reason: result.reason,
          markMessage: result.message,
          replyMessage: result.message,
        };
      },
      markTestResult: markPlatformSmsIntegrationTestResult,
      // Authorization is enforced by the platform pre-handler hooks below.
      authGate: () => true,
      testFailureMessage: "Test SMS could not be sent",
      audit: async (request: any, action: any, metadataMessage: any) => {
        const { platformUser } = request as any;
        await insertPlatformActivityLog({
          userId: platformUser.id,
          userEmail: platformUser.email,
          action,
          targetResource: "platform_sms_integration",
          metadataMessage,
          ipAddress: request.ip,
        });
      },
    },
    (instance: any) => {
      instance.addHook("preHandler", authenticatePlatform);
      instance.addHook("preHandler", requirePlatformPermission("settings"));
    },
  );
}
