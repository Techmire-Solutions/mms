/**
 * @file useCreateWorkspaceRole.ts
 * @description Append a WorkspaceRole to Users preferences (Roles & Permissions catalog).
 */
import { useCallback } from "react";
import {
  filterRbacModulesForSettings,
  normalizePermissionMap,
  workspaceRoleLabel,
  type WorkspaceRole,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useGlobalSettings } from "../host/useGlobalSettings";
import { usePermissions } from "../host/usePermissions";
import { useWorkspaceRoles } from "../host/useWorkspaceRoles";
import { useUsersConfig } from "../host/useUsersConfig";
import { notify } from "@mms/fe-core/notify";

export interface UseCreateWorkspaceRoleResult {
  canCreate: boolean;
  visibleModules: ReturnType<typeof filterRbacModulesForSettings>;
  createRole: (role: WorkspaceRole) => Promise<WorkspaceRole | null>;
}

/** Create/update a workspace role via Users preferences PUT. */
export function useCreateWorkspaceRole(): UseCreateWorkspaceRoleResult {
  const { t } = useTranslation();
  const { settings, updateSettingsAsync } = useUsersConfig();
  const globalSettings = useGlobalSettings();
  const { canManageRole, canAccessRolesAndPermissions } = usePermissions();
  const loadedRoles = useWorkspaceRoles();
  const visibleModules = filterRbacModulesForSettings(globalSettings.enabledModules);
  const canCreate = canAccessRolesAndPermissions;

  const createRole = useCallback(
    async (role: WorkspaceRole): Promise<WorkspaceRole | null> => {
      if (!canAccessRolesAndPermissions || !canManageRole(role.id)) {
        notify.error(t("users.errors.cannotModifySuperAdmin"));
        return null;
      }
      const normalizedRole: WorkspaceRole = {
        ...role,
        customLabel: role.customLabel?.trim(),
        customDescription: role.customDescription?.trim(),
        permissions: normalizePermissionMap(role.permissions),
      };
      const existing = loadedRoles.find((row: WorkspaceRole) => row.id === role.id);
      const updatedRoles = existing
        ? loadedRoles.map((row: WorkspaceRole) => (row.id === role.id ? normalizedRole : row))
        : [...loadedRoles, normalizedRole];
      try {
        await updateSettingsAsync({ ...settings, workspaceRoles: updatedRoles });
        notify.success(t("users.permissions.roleSaved"), {
          description: t("users.permissions.roleSavedDesc", {
            name: workspaceRoleLabel(normalizedRole, t),
          }),
        });
        return normalizedRole;
      } catch (error) {
        notify.error(t("settings.serverSaveFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [canAccessRolesAndPermissions, canManageRole, loadedRoles, settings, t, updateSettingsAsync],
  );

  return { canCreate, visibleModules, createRole };
}
