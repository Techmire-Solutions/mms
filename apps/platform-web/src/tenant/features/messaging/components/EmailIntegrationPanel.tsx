import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mapApiFormError } from "@mms/fe-core/forms/serverFormErrors";
import { useTranslation } from "@mms/fe-core/i18n";
import { EmailIntegrationPanel as SharedEmailIntegrationPanel } from "@/components/app/IntegrationPanels/EmailIntegrationPanel";
import type { EmailIntegrationApi } from "@mms/ui/app/IntegrationPanels/types";
import {
  fetchEmailIntegration,
  saveEmailIntegration,
  testEmailIntegration,
} from "@/lib/emailIntegrationApi";

const TENANT_EMAIL_INTEGRATION_API: EmailIntegrationApi = {
  fetchConfig: fetchEmailIntegration,
  saveConfig: saveEmailIntegration,
  testConfig: testEmailIntegration,
};

/**
 * Multi-provider SMTP setup (Gmail, Microsoft 365, Outlook, Yahoo, iCloud, Zoho, custom).
 * Thin tenant adapter over the shared `IntegrationPanels` EmailIntegrationPanel.
 */
export default function EmailIntegrationPanel({
  canWrite = true,
}: {
  canWrite?: boolean;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return (
    <SharedEmailIntegrationPanel
      api={TENANT_EMAIL_INTEGRATION_API}
      canWrite={canWrite}
      showTestTargetInput
      seedTestTarget={(config) => config.fromAddress}
      resolveTestTarget={(config, testTarget) => testTarget.trim() || config.fromAddress}
      resolveActionError={(error, failedKey) => {
        const mapped = mapApiFormError(error);
        return { description: mapped.message, inlineMessage: mapped.message ?? t(failedKey) };
      }}
      onConfigSaved={() => {
        void queryClient.invalidateQueries({ queryKey: ["email-integration"] });
      }}
    />
  );
}
