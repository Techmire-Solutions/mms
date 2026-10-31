import { useState } from "react";
import {
  excludeFacultyManagedRoles,
  filterRbacModulesForSettings,
  workspaceRoleLabel,
  type WorkspaceRole,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";
import { useUsersConfig } from "@/hooks/useStandardModuleConfig";
import { notify } from "@/lib/notify";
import { useRolesPermissionDraft } from "@/tenant/features/users/hooks/useRolesPermissionDraft";

type PendingMatrixLeave =
  { type: "select"; role: WorkspaceRole } | { type: "edit"; target: WorkspaceRole | "new" };

export function useRolesPermissionsController() {
  const { t } = useTranslation();
  const { settings, updateSettingsAsync } = useUsersConfig();
  const globalSettings = useGlobalSettings();
  const { isAdmin, isSuperAdmin, canManageRole, canAccessRolesAndPermissions } = usePermissions();
  const loadedRoles = useWorkspaceRoles();
  const visibleModules = (() => filterRbacModulesForSettings(globalSettings.enabledModules))();
  const [roles, setRoles] = useState<WorkspaceRole[]>(() =>
    excludeFacultyManagedRoles(loadedRoles),
  );
  const [editing, setEdit] = useState<WorkspaceRole | "new" | null>(null);
  const [selected, setSel] = useState<WorkspaceRole | null>(null);
  const [pendingMatrixLeave, setPendingMatrixLeave] = useState<PendingMatrixLeave | null>(null);

  // Adjust state during render: a server role change (or leaving the role form) refreshes the
  // local list. `settings.workspaceRoles` is the stable source `useWorkspaceRoles` derives from,
  // so this only re-syncs when the underlying saved settings actually change.
  const [prevRoleSync, setPrevRoleSync] = useState({ source: settings.workspaceRoles, editing });
  if (prevRoleSync.source !== settings.workspaceRoles || prevRoleSync.editing !== editing) {
    setPrevRoleSync({ source: settings.workspaceRoles, editing });
    if (!editing) {
      setRoles(excludeFacultyManagedRoles(loadedRoles));
    }
  }

  const displayRole = selected ?? roles[0] ?? null;
  const canManageDisplayRole =
    Boolean(displayRole) &&
    canManageRole(displayRole?.id) &&
    displayRole?.managedBy !== "faculty_designations";

  const { permDraft, permDirty, togglePermDraft, selectAllDraft, clearAllDraft, resetPermDraft } =
    useRolesPermissionDraft(displayRole);

  const commitRole = async (
    role: WorkspaceRole,
    toastKey: "role" | "permissions",
  ): Promise<void> => {
    if (role.managedBy === "faculty_designations") {
      notify.error(t("users.roleLockedByFaculty"));
      return;
    }
    if (!canManageRole(role.id)) {
      notify.error(t("users.errors.cannotModifySuperAdmin"));
      return;
    }
    const existingRole = roles.find((workspaceRole) => workspaceRole.id === role.id);
    const updatedRoles = existingRole
      ? roles.map((workspaceRole) => (workspaceRole.id === role.id ? role : workspaceRole))
      : [...roles, role];
    try {
      await updateSettingsAsync({ ...settings, workspaceRoles: updatedRoles });
      setRoles(excludeFacultyManagedRoles(updatedRoles));
      setEdit(null);
      setSel(role);
      if (toastKey === "permissions") {
        notify.success(t("users.permissions.permissionsSaved"), {
          description: t("users.permissions.permissionsSavedDesc", {
            name: workspaceRoleLabel(role, t),
          }),
        });
      } else {
        notify.success(t("users.permissions.roleSaved"), {
          description: t("users.permissions.roleSavedDesc", { name: workspaceRoleLabel(role, t) }),
        });
      }
    } catch (error) {
      notify.error(t("settings.serverSaveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSave = (role: WorkspaceRole): void => {
    void commitRole(role, "role");
  };

  const savePermissionDraft = (): void => {
    if (!displayRole || !permDraft || !canManageDisplayRole) return;
    void commitRole({ ...displayRole, permissions: structuredClone(permDraft) }, "permissions");
  };

  const requestSelectRole = (next: WorkspaceRole): void => {
    if (displayRole?.id === next.id) return;
    if (!permDirty) {
      setSel(next);
      return;
    }
    setPendingMatrixLeave({ type: "select", role: next });
  };

  const requestEditRole = (target: WorkspaceRole | "new"): void => {
    if (target !== "new" && !canManageRole(target.id)) {
      return;
    }
    if (!permDirty) {
      setEdit(target);
      return;
    }
    setPendingMatrixLeave({ type: "edit", target });
  };

  const clearPendingMatrixLeave = (): void => {
    setPendingMatrixLeave(null);
  };

  const confirmPendingMatrixLeave = (): void => {
    if (!pendingMatrixLeave) return;
    resetPermDraft();
    if (pendingMatrixLeave.type === "select") {
      setSel(pendingMatrixLeave.role);
    } else {
      setEdit(pendingMatrixLeave.target);
    }
    setPendingMatrixLeave(null);
  };

  const closeRoleForm = (): void => {
    setEdit(null);
  };

  const editTitle = editing
    ? editing === "new"
      ? t("users.permissions.createTitle")
      : t("users.permissions.editTitle", { name: workspaceRoleLabel(editing, t) })
    : "";

  return {
    t,
    isAdmin,
    isSuperAdmin,
    canAccessRolesAndPermissions,
    canManageRole,
    canManageDisplayRole,
    visibleModules,
    roles,
    editing,
    requestSelectRole,
    requestEditRole,
    closeRoleForm,
    pendingMatrixLeave,
    clearPendingMatrixLeave,
    confirmPendingMatrixLeave,
    displayRole,
    permDraft,
    permDirty,
    togglePermDraft: canManageDisplayRole ? togglePermDraft : () => {},
    selectAllDraft: canManageDisplayRole ? selectAllDraft : () => {},
    clearAllDraft: canManageDisplayRole ? clearAllDraft : () => {},
    resetPermDraft,
    handleSave,
    savePermissionDraft,
    editTitle,
  };
}
