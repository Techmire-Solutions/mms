import React, { Suspense } from "react";
import { Settings, Globe, Palette, ShieldCheck, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import {
  ResponsiveAccordionTabs,
  type AccordionTabItem,
} from "@/components/app/ResponsiveAccordionTabs";
import { CardSkeleton } from "@/components/app/LoadingState";
import { PlatformGlobalSettingsPanel } from "@/platform/components/settings/PlatformGlobalSettingsPanel";
import { PlatformThemeSettingsPanel } from "@/platform/components/settings/PlatformThemeSettingsPanel";
import { PlatformSecuritySettingsPanel } from "@/platform/components/settings/PlatformSecuritySettingsPanel";
import { PlatformNotificationsSettingsPanel } from "@/platform/components/settings/PlatformNotificationsSettingsPanel";

export type PlatformSettingsSection = "global" | "theme" | "notifications" | "security";

function parseSettingsSection(raw: string | null): PlatformSettingsSection {
  if (raw === "theme" || raw === "notifications" || raw === "security" || raw === "global")
    return raw;
  return "global";
}

export default function PlatformSettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = parseSettingsSection(searchParams.get("section"));

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

  const tabs: AccordionTabItem[] = [
    {
      id: "global",
      label: t("platform.settingsTabGlobal"),
      icon: Globe,
    },
    {
      id: "theme",
      label: t("platform.settingsTabTheme"),
      icon: Palette,
    },
    {
      id: "notifications",
      label: t("platform.notifications"),
      icon: Bell,
    },
    {
      id: "security",
      label: t("platform.settingsTabSecurity"),
      icon: ShieldCheck,
    },
  ];

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
          <motion.div
            key={activeSection}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Suspense fallback={<CardSkeleton count={2} />}>
              {activeSection === "global" && <PlatformGlobalSettingsPanel />}
              {activeSection === "theme" && <PlatformThemeSettingsPanel />}
              {activeSection === "notifications" && <PlatformNotificationsSettingsPanel />}
              {activeSection === "security" && <PlatformSecuritySettingsPanel />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </ResponsiveAccordionTabs>
    </ModulePageShell>
  );
}
