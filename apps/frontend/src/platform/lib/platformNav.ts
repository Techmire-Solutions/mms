import type React from "react";
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  Users,
  User,
  Server,
  Activity,
  Waypoints,
  Settings,
  Palette,
} from "lucide-react";
import { ROUTES } from "@/lib/config/routes";
import type { AppTranslationKey } from "@mms/shared";
import type { PlatformPermissionsState } from "@/platform/hooks/usePlatformPermissions";

/** SaaS console nav sections — Overview → Workspaces → Access → Operations → Account. */
export type PlatformNavSection = "overview" | "workspaces" | "access" | "ops" | "account";

export interface PlatformNavItem {
  id: string;
  path: string;
  labelKey: AppTranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  section: PlatformNavSection;
  isVisible: (perms: PlatformPermissionsState) => boolean;
}

/**
 * Single Source of Truth (SSOT) registry for Platform Apex navigation items.
 * Drives desktop sidebar navigation and mobile drawer.
 */
export const PLATFORM_NAV_ITEMS: readonly PlatformNavItem[] = [
  {
    id: "dashboard",
    path: ROUTES.platformDashboard,
    labelKey: "dashboard.title",
    icon: LayoutDashboard,
    section: "overview",
    isVisible: () => true,
  },
  {
    id: "workspaces",
    path: ROUTES.platformWorkspaces,
    labelKey: "platform.manageMadrasas",
    icon: Building2,
    section: "workspaces",
    isVisible: (perms) => perms.canWorkspaces,
  },
  {
    id: "reports",
    path: ROUTES.platformReports,
    labelKey: "module.reports",
    icon: BarChart3,
    section: "workspaces",
    isVisible: (perms) => perms.canWorkspaces,
  },
  {
    id: "users",
    path: ROUTES.platformUsers,
    labelKey: "nav.users",
    icon: Users,
    section: "access",
    isVisible: (perms) => perms.canAdmins,
  },
  {
    id: "activityLogs",
    path: ROUTES.platformActivityLogs,
    labelKey: "platform.activityLogsTitle",
    icon: Activity,
    section: "ops",
    isVisible: (perms) => perms.canSystem,
  },
  {
    id: "settings",
    path: ROUTES.platformSettings,
    labelKey: "settings.title",
    icon: Settings,
    section: "ops",
    isVisible: (perms) => perms.canSettings,
  },
  {
    id: "system",
    path: ROUTES.platformSystem,
    labelKey: "platform.systemMaintenance",
    icon: Server,
    section: "ops",
    isVisible: (perms) => perms.canSystem,
  },
  {
    id: "erd",
    path: ROUTES.platformErd,
    labelKey: "platform.erdTitle",
    icon: Waypoints,
    section: "ops",
    isVisible: (perms) => perms.canSystem,
  },
  {
    id: "designSystem",
    path: ROUTES.platformDesignSystem,
    labelKey: "platform.designSystemTitle",
    icon: Palette,
    section: "ops",
    isVisible: (perms) => perms.canSystem,
  },
  {
    id: "account",
    path: ROUTES.platformAccount,
    labelKey: "platform.myAccount",
    icon: User,
    section: "account",
    isVisible: () => true,
  },
] as const;

/**
 * Filtered navigation items for the currently logged-in platform user.
 */
export function getVisiblePlatformNavItems(perms: PlatformPermissionsState): PlatformNavItem[] {
  return PLATFORM_NAV_ITEMS.filter((item) => item.isVisible(perms));
}

export function getVisiblePlatformNavSections(perms: PlatformPermissionsState) {
  const grouped = Object.groupBy(getVisiblePlatformNavItems(perms), (item) => item.section);
  const order: PlatformNavSection[] = ["overview", "workspaces", "access", "ops", "account"];
  return order
    .filter((section) => (grouped[section]?.length ?? 0) > 0)
    .map((section) => ({
      section,
      items: grouped[section] ?? [],
    }));
}
