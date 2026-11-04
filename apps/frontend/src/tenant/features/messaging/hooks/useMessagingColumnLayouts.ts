import { useMemo } from "react";
import { MESSAGING_MODULE_MANIFEST, buildMessagingHistoryWorkColumnRegistry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useModuleColumnLayout } from "@/hooks/useModuleColumnLayout";

export function useMessagingHistoryColumnLayout() {
  const { t } = useTranslation();

  // Stable identity: the column layout hook memoizes on `tenantRegistry`.
  const tenantRegistry = useMemo(
    () =>
      buildMessagingHistoryWorkColumnRegistry({
        recipient: t("messaging.recipient"),
        channel: t("messaging.channel"),
        body: t("messaging.messageBody"),
        dateSent: t("messaging.dateSent"),
      }),
    [t],
  );

  return useModuleColumnLayout({
    moduleId: `${MESSAGING_MODULE_MANIFEST.moduleId}_history`,
    tenantRegistry,
    apiPath: `${MESSAGING_MODULE_MANIFEST.restBasePath}/history`,
    translationPrefix: "messaging.columns",
  });
}
