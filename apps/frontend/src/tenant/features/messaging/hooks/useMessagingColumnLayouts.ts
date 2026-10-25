import {
  MESSAGING_MODULE_MANIFEST,
  buildMessagingHistoryWorkColumnRegistry,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useMessagingHistoryColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildMessagingHistoryWorkColumnRegistry({
      recipient: t("messaging.recipient"),
      channel: t("messaging.channel"),
      body: t("messaging.messageBody"),
      dateSent: t("messaging.dateSent"),
    }))();

  return useModuleColumnLayout({
    moduleId: `${MESSAGING_MODULE_MANIFEST.moduleId}_history`,
    tenantRegistry,
    apiPath: `${MESSAGING_MODULE_MANIFEST.restBasePath}/history`,
    translationPrefix: "messaging.columns",
  });
}
