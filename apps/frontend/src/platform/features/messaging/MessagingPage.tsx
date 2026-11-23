import React from "react";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import {
  MessagingTier,
  type PlatformMessagingTab,
} from "@/platform/features/messaging/components/MessagingTier";
import { usePlatformModuleTabs } from "@/platform/hooks/usePlatformModuleTabs";
import { usePlatformModuleTabState } from "@/platform/hooks/usePlatformModuleTabState";
import { PLATFORM_MODULE_MESSAGING } from "@/platform/lib/platformModuleManifest";

export default function MessagingPage(): React.JSX.Element {
  const { t } = useTranslation();
  const tabs = usePlatformModuleTabs(PLATFORM_MODULE_MESSAGING);
  const { activeTab, handleTabChange } = usePlatformModuleTabState("platform_messaging_tab", tabs);

  return (
    <ModulePageShell
      seoTitle={`${t("nav.messaging")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.messaging.subtitle")}
      headerIcon={MessageSquare}
      headerTitle={t("nav.messaging")}
      headerSubtitle={t("platform.messaging.subtitle")}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      panelIdPrefix="platform-messaging-tab"
    >
      <MessagingTier activeTab={activeTab as PlatformMessagingTab} />
    </ModulePageShell>
  );
}
