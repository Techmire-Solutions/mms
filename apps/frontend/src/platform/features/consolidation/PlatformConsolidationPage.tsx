import React from "react";
import { Layers } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import {
  PlatformConsolidationTier,
  type PlatformConsolidationTab,
} from "@/platform/features/consolidation/components/PlatformConsolidationTier";
import { usePlatformModuleTabs } from "@/platform/hooks/usePlatformModuleTabs";
import { usePlatformModuleTabState } from "@/platform/hooks/usePlatformModuleTabState";
import { PLATFORM_MODULE_CONSOLIDATION } from "@/platform/lib/platformModuleManifest";

export default function PlatformConsolidationPage(): React.JSX.Element {
  const { t } = useTranslation();
  const tabs = usePlatformModuleTabs(PLATFORM_MODULE_CONSOLIDATION);
  const { activeTab, handleTabChange } = usePlatformModuleTabState(
    "platform_consolidation_tab",
    tabs,
  );

  return (
    <ModulePageShell
      seoTitle={`${t("platform.consolidation.title")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.consolidation.subtitle")}
      headerIcon={Layers}
      headerTitle={t("platform.consolidation.title")}
      headerSubtitle={t("platform.consolidation.subtitle")}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      panelIdPrefix="platform-consolidation-tab"
    >
      <PlatformConsolidationTier activeTab={activeTab as PlatformConsolidationTab} />
    </ModulePageShell>
  );
}
