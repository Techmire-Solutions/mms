import React from "react";
import { useLocation } from "react-router-dom";
import { type PlatformNavSection, type PlatformNavItem } from "@/platform/lib/platformNav";
import { useTranslation } from "@/hooks/useTranslation";
import type { AppTranslationKey } from "@mms/shared";
import { SidebarNavItem } from "@/components/app/SidebarNavItem";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isNavPathActive } from "@/lib/config/routes";

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
 * Grouped sidebar navigation: collapses to an icon rail with tooltips (desktop),
 * always expanded on mobile. Route items render via the shared `SidebarNavItem`.
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

  return (
    <nav className="flex-1 py-3 px-3 space-y-4 overflow-y-auto" aria-label={t("platform.navAria")}>
      {sections.map(({ section, items }, sIndex) => {
        const sectionTitleKey = SECTION_LABEL_KEYS[section];
        const showHeader = !collapsed || isMobile;

        return (
          <div key={section} className="space-y-1">
            {showHeader && sectionTitleKey ? (
              <div
                className={cn(
                  "px-3 pb-1 text-2xs uppercase tracking-wider font-mono text-sidebar-muted-foreground/80 font-bold",
                  sIndex > 0 ? "pt-2" : "",
                )}
              >
                {t(sectionTitleKey)}
              </div>
            ) : null}

            {items.map((item) => {
              const isActive = isNavPathActive(location.pathname, item.path);
              const label = t(item.labelKey);

              const linkNode = (
                <SidebarNavItem
                  key={item.id}
                  to={item.path}
                  label={label}
                  icon={item.icon}
                  active={isActive}
                  showLabel={isMobile || !collapsed}
                  collapsed={collapsed}
                  reducedMotion={reducedMotion}
                  layoutId="platform-sidebar-indicator"
                  centerIconWhenCollapsed
                  activeShadow
                  onClick={() => isMobile && closeMobileSidebar()}
                />
              );

              if (!isMobile && collapsed) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
                    <TooltipContent
                      side={dir === "rtl" ? "left" : "right"}
                      sideOffset={12}
                      className="font-semibold text-xs bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-md"
                    >
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkNode;
            })}
          </div>
        );
      })}
    </nav>
  );
}
