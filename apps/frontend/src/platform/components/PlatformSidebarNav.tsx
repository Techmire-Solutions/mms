import React from "react";
import { useLocation } from "react-router-dom";
import { type PlatformNavSection, type PlatformNavItem } from "@/platform/lib/platformNav";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";
import { isNavPathActive } from "@/lib/config/routes";
import { AppSidebarNav, type AppNavSection } from "@/components/common/AppSidebarNav";

const SECTION_LABEL_KEYS: Record<PlatformNavSection, AppTranslationKey | null> = {
  overview: "platform.nav.sectionOverview",
  workspaces: "platform.nav.sectionWorkspaces",
  access: "platform.nav.sectionAccess",
  ops: "platform.nav.sectionOps",
  account: null,
};

export interface PlatformSidebarNavProps {
  sections: { section: PlatformNavSection; items: PlatformNavItem[] }[];
  collapsed: boolean;
  isMobile: boolean;
  reducedMotion: boolean;
  closeMobileSidebar: () => void;
}

/**
 * Platform nav adapter — maps the sectioned registry onto the shared
 * `AppSidebarNav` renderer (sectioned icon rail with collapsed tooltips).
 */
export function PlatformSidebarNav({
  sections,
  collapsed,
  isMobile,
  reducedMotion,
  closeMobileSidebar,
}: PlatformSidebarNavProps): React.JSX.Element {
  const { t, dir } = useTranslation();
  const location = useLocation();

  const navSections: AppNavSection[] = sections.map(({ section, items }) => {
    const labelKey = SECTION_LABEL_KEYS[section];
    return {
      id: section,
      label: labelKey ? t(labelKey) : undefined,
      entries: items.map((item) => ({
        kind: "link" as const,
        link: {
          id: item.id,
          label: t(item.labelKey),
          icon: item.icon,
          path: item.path,
          active: isNavPathActive(location.pathname, item.path),
          onNavigate: isMobile ? closeMobileSidebar : undefined,
        },
      })),
    };
  });

  return (
    <AppSidebarNav
      sections={navSections}
      collapsed={collapsed}
      isMobile={isMobile}
      reducedMotion={reducedMotion}
      collapsedTooltips
      dir={dir}
      layoutId="platform-sidebar-indicator"
      centerIconWhenCollapsed
      activeShadow
      navClassName="flex-1 py-3 px-3 space-y-4 overflow-y-auto"
      navAriaLabel={t("platform.navAria")}
    />
  );
}
