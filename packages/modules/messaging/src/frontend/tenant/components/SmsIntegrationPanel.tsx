import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listSmsProviderPresets } from "@mms/contracts";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useTranslation } from "@mms/fe-core/i18n";
import { SmsIntegrationPanel as SharedSmsIntegrationPanel } from "../../components/IntegrationPanels/SmsIntegrationPanel";
import type { SmsIntegrationApi } from "@mms/ui/app/IntegrationPanels/types";
import {
  fetchSmsIntegration,
  saveSmsIntegration,
  testSmsIntegration,
} from "../lib/smsIntegrationApi";

const TENANT_SMS_INTEGRATION_API: SmsIntegrationApi = {
  fetchConfig: fetchSmsIntegration,
  saveConfig: saveSmsIntegration,
  testConfig: testSmsIntegration,
};

function resolveSelectedPresetBaseUrlPlaceholder(
  configApiBaseUrl: string | undefined,
  providerId: string,
): string | undefined {
  const presets = listSmsProviderPresets();
  const preset = presets.find((p) => p.id === providerId) ?? presets[0];
  return configApiBaseUrl?.trim() || preset.baseUrlPlaceholder || undefined;
}

/**
 * One active provider at a time — Twilio, Vonage, MSG91, Infobip, or Telesign.
 * Thin tenant adapter over the shared `IntegrationPanels` SmsIntegrationPanel.
 */
export default function SmsIntegrationPanel({
  canWrite = true,
}: {
  canWrite?: boolean;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return (
    <SharedSmsIntegrationPanel
      api={TENANT_SMS_INTEGRATION_API}
      canWrite={canWrite}
      seedTestTarget={(config) => config.senderId}
      prepareSaveConfig={(config, accountSecret) => ({
        ...config,
        apiBaseUrl: resolveSelectedPresetBaseUrlPlaceholder(config.apiBaseUrl, config.providerId),
        accountSecret: accountSecret.trim() || undefined,
      })}
      resolveTestTarget={(config, testPhone) => testPhone.trim() || config.senderId.trim()}
      testTargetRequiredKey="sms.testPhonePlaceholder"
      resolveActionError={(error, failedKey) => {
        const mapped = mapApiFormError(error);
        return { description: mapped.message, inlineMessage: mapped.message ?? t(failedKey) };
      }}
      onConfigSaved={() => {
        void queryClient.invalidateQueries({ queryKey: ["sms-integration"] });
      }}
    />
  );
}
