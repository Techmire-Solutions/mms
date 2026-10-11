/**
 * @file useCreateWorkspaceRole.ts
 * @description Append a WorkspaceRole to Users preferences (Roles & Permissions catalog).
 */
import { useCallback } from "react";
import { filterRbacModulesForSettings, workspaceRoleLabel, type WorkspaceRole } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { notify } from "@/lib/notify";

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
      const existing = loadedRoles.find((row) => row.id === role.id);
      const updatedRoles = existing
        ? loadedRoles.map((row) => (row.id === role.id ? role : row))
        : [...loadedRoles, role];
      try {
        await updateSettingsAsync({ ...settings, workspaceRoles: updatedRoles });
        notify.success(t("users.permissions.roleSaved"), {
          description: t("users.permissions.roleSavedDesc", { name: workspaceRoleLabel(role, t) }),
        });
        return role;
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
