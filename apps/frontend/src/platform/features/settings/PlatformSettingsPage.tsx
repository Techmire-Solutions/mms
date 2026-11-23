import React, { Suspense } from "react";
import { Settings } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import {
  ResponsiveAccordionTabs,
  type AccordionTabItem,
} from "@/components/app/ResponsiveAccordionTabs";
import { CardSkeleton } from "@shared/ui";
import {
  PLATFORM_SETTINGS_NAV,
  parsePlatformSettingsSection,
} from "@/platform/features/settings/lib/platformSettingsNavConfig";
import { PLATFORM_SETTINGS_SECTION_COMPONENTS } from "@/platform/features/settings/lib/platformSettingsSectionComponents";

export type { PlatformSettingsSection } from "@/platform/features/settings/lib/platformSettingsNavConfig";

export default function PlatformSettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = parsePlatformSettingsSection(searchParams.get("section"));
  const ActivePanel = PLATFORM_SETTINGS_SECTION_COMPONENTS[activeSection];

  const handleSectionChange = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("section", id);
        return next;
      },
      { replace: true },
    );
  };

  const tabs: AccordionTabItem[] = PLATFORM_SETTINGS_NAV.map((item) => ({
    id: item.id,
    label: t(item.labelKey),
    icon: item.icon,
  }));

  return (
    <ModulePageShell
      seoTitle={`${t("platform.settingsPageTitle")} | ${t("platform.consoleTitle")}`}
      seoDescription={t("platform.settingsPageSubtitle")}
      headerIcon={Settings}
      headerTitle={t("platform.settingsPageTitle")}
      headerSubtitle={t("platform.settingsPageSubtitle")}
    >
      <ResponsiveAccordionTabs
        tabs={tabs}
        activeTab={activeSection}
        onTabChange={handleSectionChange}
        desktopLayout="sidebar"
        collapsible={false}
        panelIdPrefix="platform-settings-panel"
      >
        <AnimatePresence mode="wait">
          <m.div
            key={activeSection}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense fallback={<CardSkeleton count={2} />}>
              <ActivePanel />
            </Suspense>
          </m.div>
        </AnimatePresence>
      </ResponsiveAccordionTabs>
    </ModulePageShell>
  );
}
