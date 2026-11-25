/**
 * Composition adapter for the messaging module.
 *
 * Binds the module's kernel ports to the app-only services it may not import:
 * contacts reads, SMS/email/WhatsApp transports, strict rate limiting, background
 * jobs, auth-artifact idempotency and the CSV-export job runner. Called once at
 * app module load, before background job runners register.
 */
import { configureMessagingPorts } from "@mms/mod-messaging/backend/deps";
import {
  loadContactsPageForTenant,
  loadContactsSummaryByIdsForTenant,
} from "@mms/mod-contacts/backend/services";
import { loadContactFieldConfig } from "@mms/mod-contacts/backend/use-cases";
import { sendTenantSms } from "../../services/sms/smsService.js";
import { sendTenantWhatsApp } from "../../services/whatsapp/whatsappService.js";
import { sendTenantEmail } from "../../services/email/emailService.js";
import { createStrictRateLimitGuard as createStrictGuard } from "../../lib/rateLimitGuard.js";
import { MESSAGING_LOG_RATE_LIMIT } from "../../lib/rateLimitConfig.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
} from "../../services/backgroundJobWorkerService.js";
import * as authArtifacts from "../../services/auth/authArtifactService.js";
import { registerModuleCsvExportJobRunner } from "../../lib/registerModuleCsvExportJobRunner.js";

export function configureMessagingAdapters(): void {
  configureMessagingPorts({
    loadContactsPageForTenant,
    loadContactsSummaryByIdsForTenant,
    loadContactFieldConfig,
    sendTenantSms,
    sendTenantWhatsApp,
    sendTenantEmail,
    createStrictRateLimitGuard: (scope) =>
      createStrictGuard(scope as Parameters<typeof createStrictGuard>[0], MESSAGING_LOG_RATE_LIMIT),
    enqueueBackgroundJob,
    getUserBackgroundJob,
    getUserBackgroundJobPayload,
    authArtifactUserScopeKey: authArtifacts.authArtifactUserScopeKey,
    authArtifactWorkspaceScopeKey: authArtifacts.authArtifactWorkspaceScopeKey,
    deleteAuthArtifact: authArtifacts.deleteAuthArtifact,
    findAuthArtifactByLookupKey: authArtifacts.findAuthArtifactByLookupKey,
    tryClaimAuthArtifactByLookupKey: authArtifacts.tryClaimAuthArtifactByLookupKey,
    updateAuthArtifactPayload: authArtifacts.updateAuthArtifactPayload,
    registerModuleCsvExportJobRunner: (options) =>
      registerModuleCsvExportJobRunner(
        options as Parameters<typeof registerModuleCsvExportJobRunner>[0],
      ),
  });
}
