import { BookOpen, type LucideIcon } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";
import {
  ACADEMICS_GROUP_ORDER,
  TENANT_APP_ENTRIES,
  type TenantAppEntry,
  type TenantNavMeta,
} from "@/lib/routing/moduleRegistry";

export interface NavSubItem {
  labelKey: AppTranslationKey;
  icon: LucideIcon;
  path: string;
}

export interface NavItem {
  labelKey: AppTranslationKey;
  icon: LucideIcon;
  path?: string;
  subItems?: NavSubItem[];
}

type NavEntry = TenantAppEntry & { nav: TenantNavMeta };

const withNav = TENANT_APP_ENTRIES.filter((entry): entry is NavEntry => Boolean(entry.nav));

const toNavItem = (entry: NavEntry): NavItem => ({
  labelKey: entry.nav.labelKey,
  icon: entry.nav.icon,
  path: entry.path,
});

const toSubItem = (entry: NavEntry): NavSubItem => ({
  labelKey: entry.nav.labelKey,
  icon: entry.nav.icon,
  path: entry.path,
});

/**
 * Primary sidebar / mobile navigation structure — derived from the module
 * registry. Access filtering happens downstream (`useSidebarNav`).
 */
export const NAV_ITEMS: NavItem[] = (() => {
  const academics = withNav
    .filter((entry) => entry.nav.group === "academics")
    .sort((a, b) => a.nav.order - b.nav.order)
    .map(toSubItem);

  const nodes: { order: number; item: NavItem }[] = [
    ...withNav
      .filter((entry) => !entry.nav.group)
      .map((entry) => ({ order: entry.nav.order, item: toNavItem(entry) })),
    {
      order: ACADEMICS_GROUP_ORDER,
      item: { labelKey: "nav.academics", icon: BookOpen, subItems: academics },
    },
  ];

  return nodes.sort((a, b) => a.order - b.order).map((node) => node.item);
})();
