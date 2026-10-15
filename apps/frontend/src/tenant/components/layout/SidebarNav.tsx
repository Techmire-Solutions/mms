import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { isNavPathActive, ROUTES } from "@/lib/config/routes";
import type { NavItem } from "@/lib/config/navConfig";
import { useIndustryTerminology } from "@/tenant/hooks/useIndustryTerminology";
import {
  AppSidebarNav,
  type AppNavEntry,
  type AppNavSection,
} from "@/components/common/AppSidebarNav";

interface SidebarNavProps {
  collapsed: boolean;
  locationPathname: string;
  visibleMenuItems: NavItem[];
  openMenus: Record<string, boolean>;
  onToggleMenu: (labelKey: string) => void;
}

/**
 * Tenant nav adapter — maps the flat registry `NavItem[]` (with one expandable
 * "Academics" group) onto the shared `AppSidebarNav` renderer.
 */
export function SidebarNav({
  collapsed,
  locationPathname,
  visibleMenuItems,
  openMenus,
  onToggleMenu,
}: SidebarNavProps): React.JSX.Element {
  const { t } = useTranslation();
  const terminology = useIndustryTerminology();

  const resolveNavLabel = (labelKey: NavItem["labelKey"]): string => {
    if (labelKey === "nav.faculty") return terminology.facultyLabel;
    if (labelKey === "nav.students") return terminology.studentLabel;
    // Nav keys are parameter-free; cast avoids union-with-params overload of `t`.
    return t(labelKey as "nav.dashboard");
  };

  const entries: AppNavEntry[] = visibleMenuItems.map((item) => {
    if (item.subItems) {
      return {
        kind: "group",
        group: {
          id: item.labelKey,
          label: resolveNavLabel(item.labelKey),
          icon: item.icon,
          active: item.subItems.some((sub) => isNavPathActive(locationPathname, sub.path)),
          open: Boolean(openMenus[item.labelKey]),
          items: item.subItems.map((sub) => ({
            id: sub.path,
            label: resolveNavLabel(sub.labelKey),
            icon: sub.icon,
            path: sub.path,
            active: isNavPathActive(locationPathname, sub.path),
          })),
        },
      };
    }

    const path = item.path ?? ROUTES.home;
    return {
      kind: "link",
      link: {
        id: item.path || item.labelKey,
        label: resolveNavLabel(item.labelKey),
        icon: item.icon,
        path,
        active: isNavPathActive(locationPathname, path),
      },
    };
  });

  const sections: AppNavSection[] = [{ id: "tenant", entries }];

  return (
    <AppSidebarNav
      sections={sections}
      collapsed={collapsed}
      layoutId="sidebar-indicator"
      onToggleGroup={onToggleMenu}
      navClassName="flex-1 py-4 px-3 space-y-1 overflow-y-auto"
    />
  );
}
