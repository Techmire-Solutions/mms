import type {
  EmailIntegrationApi,
  SmsIntegrationApi,
} from "@/components/app/IntegrationPanels/types";
import {
  fetchPlatformEmailIntegration,
  savePlatformEmailIntegration,
  testPlatformEmailIntegration,
} from "@/lib/platformEmailIntegrationApi";
import {
  fetchPlatformSmsIntegration,
  savePlatformSmsIntegration,
  testPlatformSmsIntegration,
} from "@/lib/platformSmsIntegrationApi";

/** Platform apex adapters for the shared integration panels (no tenant query invalidation). */
export const PLATFORM_EMAIL_INTEGRATION_API: EmailIntegrationApi = {
  fetchConfig: fetchPlatformEmailIntegration,
  saveConfig: savePlatformEmailIntegration,
  testConfig: () => testPlatformEmailIntegration(),
};

export const PLATFORM_SMS_INTEGRATION_API: SmsIntegrationApi = {
  fetchConfig: fetchPlatformSmsIntegration,
  saveConfig: savePlatformSmsIntegration,
  testConfig: (testPhone) => testPlatformSmsIntegration(testPhone),
};
