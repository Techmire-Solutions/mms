import type { AppTranslationKey, PlatformAdminPermissionKey } from "@mms/shared";

/** Lightweight platform module manifest — mirrors the tenant module manifest's tier gating. */
export interface PlatformModuleManifest {
  /** Stable module id (used for route/nav/testing ids). */
  moduleId: string;
  /** i18n key for the primary operational tab label (module name, never `module.work`). */
  workLabelKey: AppTranslationKey;
  /** Grantable capability required to enter the module. */
  permissionKey: PlatformAdminPermissionKey;
  /** Capability required for the Reports tier (defaults to `permissionKey`). */
  reportsPermissionKey?: PlatformAdminPermissionKey;
  /** Capability required for the Setup tier (defaults to `settings`). */
  setupPermissionKey?: PlatformAdminPermissionKey;
}

export const PLATFORM_MODULE_WORKSPACES: PlatformModuleManifest = {
  moduleId: "workspaces",
  workLabelKey: "platform.manageMadrasas",
  permissionKey: "workspaces",
};

export const PLATFORM_MODULE_USERS: PlatformModuleManifest = {
  moduleId: "users",
  workLabelKey: "nav.users",
  permissionKey: "admins",
  reportsPermissionKey: "admins",
  setupPermissionKey: "admins",
};

export const PLATFORM_MODULE_CONSOLIDATION: PlatformModuleManifest = {
  moduleId: "consolidation",
  workLabelKey: "platform.consolidation.title",
  permissionKey: "workspaces",
};

export const PLATFORM_MODULE_CONTACTS: PlatformModuleManifest = {
  moduleId: "contacts",
  workLabelKey: "nav.contacts",
  permissionKey: "contacts",
};

export const PLATFORM_MODULE_MESSAGING: PlatformModuleManifest = {
  moduleId: "messaging",
  workLabelKey: "nav.messaging",
  permissionKey: "messaging",
};
