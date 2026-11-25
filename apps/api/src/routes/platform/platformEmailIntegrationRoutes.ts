import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type {
  EmailIntegrationConfig,
  EmailIntegrationSecrets,
  EmailProviderId,
} from "@mms/contracts";
import {
  isEmailProviderId,
  mergeEmailIntegrationConfig,
  emailIntegrationBodySchema,
} from "@mms/contracts";
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
import { insertPlatformActivityLog } from "../../platform/use-cases/platformUseCases.js";
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

export default async function platformEmailIntegrationRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  registerIntegrationRoutes<
    EmailIntegrationConfig,
    EmailIntegrationSecrets,
    EmailIntegrationPutBody,
    undefined
  >(
    fastify,
    {
      integrationBodySchema: emailIntegrationBodySchema,
      isProviderId: isEmailProviderId,
      unsupportedProviderMessage: "Unsupported email provider",
      load: loadPlatformEmailIntegrationConfig,
      save: savePlatformEmailIntegrationConfig,
      saveSecrets: savePlatformEmailIntegrationSecrets,
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
      // The platform test-send ignores the request body and targets the
      // session platform user — preserved from the original handler.
      testSend: async (request) => {
        const { platformUser } = request as PlatformAuthenticatedRequest;

        const verify = await verifyPlatformEmailTransport();
        if (!verify.sent) {
          return {
            sent: false,
            reason: verify.reason,
            markMessage: verify.message,
            replyMessage: verify.message ?? "Email is not configured",
          };
        }

        const result = await sendPlatformEmail({
          to: platformUser.email,
          subject: "MMS platform email test",
          text: "Your MMS platform email integration is working.",
        });
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
      markTestResult: markPlatformEmailIntegrationTestResult,
      // Authorization is enforced by the platform pre-handler hooks below.
      authGate: () => true,
      testFailureMessage: "Test email could not be sent",
      // Record every config save and test-send against the apex activity log so
      // platform integration mutations leave an audit trail (they are the one
      // surface that previously emitted no row).
      audit: async (request, action, metadataMessage) => {
        const { platformUser } = request as PlatformAuthenticatedRequest;
        await insertPlatformActivityLog({
          userId: platformUser.id,
          userEmail: platformUser.email,
          action,
          targetResource: "platform_email_integration",
          metadataMessage,
          ipAddress: request.ip,
        });
      },
    },
    (instance) => {
      instance.addHook("preHandler", authenticatePlatform);
      instance.addHook("preHandler", requirePlatformPermission("settings"));
    },
  );
}
