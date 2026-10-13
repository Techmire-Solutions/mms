import React, { Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings as SettingsIcon } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ResponsiveAccordionTabs,
  type AccordionTabItem,
} from "@/components/app/ResponsiveAccordionTabs";
import { isSettingsSection, type SettingsSection } from "@/lib/config/routes";
import { SETTINGS_NAV } from "@/lib/config/settingsNavConfig";
import { SETTINGS_SECTION_COMPONENTS } from "@/lib/config/settingsSectionComponents";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { SettingsTabProvider } from "@/lib/contexts/SettingsTabContext";
import { SettingsBrandingDraftProvider } from "@/lib/contexts/SettingsBrandingDraftContext";
import { SettingsGlobalDraftProvider } from "@/lib/contexts/SettingsGlobalDraftContext";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ModulePanelSuspenseFallback } from "@/components/app/ModulePanelSuspenseFallback";

function SettingsContent({ section }: { section: SettingsSection }): React.JSX.Element {
  const Component = SETTINGS_SECTION_COMPONENTS[section];
  return (
    <Suspense fallback={<ModulePanelSuspenseFallback />}>
      <Component />
    </Suspense>
  );
}

/**
 * App-wide settings only. Per-module configuration lives in each module's
 * Configuration tab (Fields / Preferences). All sections share `/settings`.
 */
export default function Settings(): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = usePersistedTabState<SettingsSection>("mms-settings-tab", "global");
  const requestedTab = (useLocation().state as { settingsTab?: unknown } | null)?.settingsTab;

  // Deep links (e.g. "Open Settings → Modules" from a disabled-module screen) pick the section.
  useEffect(() => {
    if (typeof requestedTab === "string" && isSettingsSection(requestedTab)) setTab(requestedTab);
  }, [requestedTab]); // eslint-disable-line react-hooks/exhaustive-deps -- setTab identity changes per render

  const handleTabChange = (id: string) => {
    if (isSettingsSection(id)) {
      setTab(id);
    }
  };

  const visibleNav = SETTINGS_NAV.filter(
    (item) => !item.requiredPermission || can(item.requiredPermission),
  );
  const visibleIds = new Set(visibleNav.map((item) => item.id));
  // A persisted tab from a prior session/role (e.g. an admin-only section) that the
  // current user can no longer see falls back to General rather than rendering nothing.
  const effectiveTab: SettingsSection = visibleIds.has(tab) ? tab : "global";

  const tabs: AccordionTabItem[] = visibleNav.map((item) => ({
    id: item.id,
    label: t(item.labelKey),
    icon: item.icon,
  }));

  return (
    <SettingsTabProvider value={{ activeTab: tab, setActiveTab: setTab }}>
      <SettingsGlobalDraftProvider>
        <SettingsBrandingDraftProvider
          saveSuccessMessage={t("branding.savedToast")}
          saveSuccessDescription={t("branding.savedToastDesc")}
        >
          <ModulePageShell
            seoTitle={`MMS - ${t("settings.title")}`}
            seoDescription={t("settings.subtitle")}
            headerIcon={SettingsIcon}
            headerTitle={t("settings.title")}
            headerSubtitle={t("settings.subtitle")}
          >
            <ResponsiveAccordionTabs
              tabs={tabs}
              activeTab={effectiveTab}
              onTabChange={handleTabChange}
              desktopLayout="sidebar"
              collapsible={false}
              panelIdPrefix="settings-panel"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={effectiveTab}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.18 }}
                >
                  <SettingsContent section={effectiveTab} />
                </motion.div>
              </AnimatePresence>
            </ResponsiveAccordionTabs>
          </ModulePageShell>
        </SettingsBrandingDraftProvider>
      </SettingsGlobalDraftProvider>
    </SettingsTabProvider>
  );
}
