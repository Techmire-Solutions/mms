import {
  MESSAGING_MODULE_MANIFEST,
  buildMessagingRecipientsWorkColumnRegistry,
  buildMessagingHistoryWorkColumnRegistry,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useMessagingRecipientsColumnLayout() {
  const { t } = useTranslation();

  const tenantRegistry = (() =>
    buildMessagingRecipientsWorkColumnRegistry({
      recipient: t("messaging.recipient"),
      phone: t("messaging.recipientPhone"),
      email: t("messaging.recipientEmail"),
    }))();

  return useModuleColumnLayout({
    moduleId: `${MESSAGING_MODULE_MANIFEST.moduleId}_recipients`,
    tenantRegistry,
    apiPath: `${MESSAGING_MODULE_MANIFEST.restBasePath}/recipients`,
    translationPrefix: "messaging.columns",
  });
}

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
