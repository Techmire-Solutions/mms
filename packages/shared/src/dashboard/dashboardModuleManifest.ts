import type { Permission } from "../auth/permissions.js";
import { DASHBOARD_PREFERENCES_KEY, DASHBOARD_WIDGETS_KEY } from "../settings/settingsTypes.js";

/**
 * Dashboard home shell contract — not a three-tier CRUD module.
 * Owns layout prefs / pinned widgets and customize permission only.
 */
export const DASHBOARD_MODULE_MANIFEST = {
  moduleId: "dashboard",
  entityType: "Dashboard",
  /** Broadcast / Query-key prefix / route mount key for server-authoritative dashboard config. */
  collectionKey: "dashboard",
  restBasePath: "/api/dashboard",
  preferencesObjectKey: DASHBOARD_PREFERENCES_KEY,
  widgetsObjectKey: DASHBOARD_WIDGETS_KEY,
  tiers: [] as const,
  permissions: {
    /** View home dashboard (authenticated tenants; coarse gate via analytics). */
    read: "analytics.view",
    /** Customize metric cards and pinned widgets. */
    customize: "configuration.view",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
  } satisfies Record<string, Permission>,
} as const;

export const DASHBOARD_ROLES = ["admin", "faculty", "accountant"] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export type DashboardModulePermission = keyof typeof DASHBOARD_MODULE_MANIFEST.permissions;
