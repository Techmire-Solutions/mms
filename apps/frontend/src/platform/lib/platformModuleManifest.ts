import type { AppTranslationKey, PlatformAdminPermissionKey } from "@mms/shared";

export const PLATFORM_MODULE_TIERS = ["work", "reports", "setup"] as const;
export type PlatformModuleTierId = (typeof PLATFORM_MODULE_TIERS)[number];

/** Soft-delete contract for a platform module's collection (mirrors tenant §6). */
export interface PlatformModuleSoftDelete {
  workExcludesDeleted: boolean;
  reportsIncludeDeleted: boolean;
  exportsIncludeDeleted: boolean;
  captureDeletionReason: boolean;
  retentionDays?: number | null;
}

/**
 * Platform module manifest — the apex counterpart of the tenant module manifest.
 * Single source of truth for tier gating, setup sub-tabs, and soft-delete policy.
 */
export interface PlatformModuleManifest {
  /** Stable module id (route/nav/testing ids). */
  moduleId: string;
  /** Entity type label used by directories/descriptors. */
  entityType: string;
  /** Stable collection key for query keys and column-preferences storage. */
  collectionKey: string;
  /** i18n key for the primary operational tab label (module name, never `module.work`). */
  workLabelKey: AppTranslationKey;
  /** Grantable capability required to enter the module. */
  permissionKey: PlatformAdminPermissionKey;
  /** Capability required for the Reports tier (defaults to `permissionKey`). */
  reportsPermissionKey?: PlatformAdminPermissionKey;
  /** Capability required for the Setup tier (defaults to `settings`). */
  setupPermissionKey?: PlatformAdminPermissionKey;
  /** Setup sub-tabs (e.g. `["templates", "preferences"]`). */
  setupSubTabs?: readonly string[];
  /** Soft-delete policy when the collection supports trash/restore. */
  softDelete?: PlatformModuleSoftDelete;
}

export const PLATFORM_MODULE_WORKSPACES: PlatformModuleManifest = {
  moduleId: "workspaces",
  entityType: "Workspace",
  collectionKey: "platformWorkspaces",
  workLabelKey: "platform.manageMadrasas",
  permissionKey: "workspaces",
  setupSubTabs: ["preferences"],
};

export const PLATFORM_MODULE_USERS: PlatformModuleManifest = {
  moduleId: "users",
  entityType: "PlatformUser",
  collectionKey: "platformAdmins",
  workLabelKey: "nav.users",
  permissionKey: "admins",
  reportsPermissionKey: "admins",
  setupPermissionKey: "admins",
  setupSubTabs: ["permissions"],
};

export const PLATFORM_MODULE_CONSOLIDATION: PlatformModuleManifest = {
  moduleId: "consolidation",
  entityType: "ConsolidationGroup",
  collectionKey: "platformConsolidationGroups",
  workLabelKey: "platform.consolidation.title",
  permissionKey: "workspaces",
  setupSubTabs: ["preferences"],
};

export const PLATFORM_MODULE_CONTACTS: PlatformModuleManifest = {
  moduleId: "contacts",
  entityType: "PlatformContact",
  collectionKey: "platformContacts",
  workLabelKey: "nav.contacts",
  permissionKey: "contacts",
  setupSubTabs: ["preferences", "fields"],
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: null,
  },
};

export const PLATFORM_MODULE_MESSAGING: PlatformModuleManifest = {
  moduleId: "messaging",
  entityType: "PlatformMessage",
  collectionKey: "platformMessages",
  workLabelKey: "nav.messaging",
  permissionKey: "messaging",
  setupSubTabs: ["templates", "preferences"],
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: 365,
  },
};
