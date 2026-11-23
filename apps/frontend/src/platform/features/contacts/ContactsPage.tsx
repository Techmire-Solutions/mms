import React from "react";
import { Users } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import {
  ContactsTier,
  type PlatformContactsTab,
} from "@/platform/features/contacts/components/ContactsTier";
import { PlatformContactsCommandMetrics } from "@/platform/features/contacts/components/PlatformContactsCommandMetrics";
import { usePlatformModuleTabs } from "@/platform/hooks/usePlatformModuleTabs";
import { usePlatformModuleTabState } from "@/platform/hooks/usePlatformModuleTabState";
import { PLATFORM_MODULE_CONTACTS } from "@/platform/lib/platformModuleManifest";

export default function ContactsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const tabs = usePlatformModuleTabs(PLATFORM_MODULE_CONTACTS);
  const { activeTab, handleTabChange } = usePlatformModuleTabState("platform_contacts_tab", tabs);

  return (
    <ModulePageShell
      seoTitle={`${t("nav.contacts")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.contacts.subtitle")}
      headerIcon={Users}
      headerTitle={t("nav.contacts")}
      headerSubtitle={t("platform.contacts.subtitle")}
      metricsStrip={<PlatformContactsCommandMetrics />}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      panelIdPrefix="platform-contacts-tab"
    >
      <ContactsTier activeTab={activeTab as PlatformContactsTab} />
    </ModulePageShell>
  );
}
