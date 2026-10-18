import { useEffect, useState } from "react";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type WorkspaceRole,
} from "@mms/shared";

export function useRolesPermissionDraft(displayRole: WorkspaceRole | null) {
  const [permDraft, setPermDraft] = useState<PermissionMap | null>(null);
  const [permDraftRoleId, setPermDraftRoleId] = useState<string | null>(null);

  useEffect(() => {
    if (!displayRole) {
      setPermDraft(null);
      setPermDraftRoleId(null);
      return;
    }
    if (displayRole.id !== permDraftRoleId) {
      setPermDraft(structuredClone(displayRole.permissions));
      setPermDraftRoleId(displayRole.id);
    }
  }, [displayRole, permDraftRoleId]);

  const permDirty = (() => {
    if (!displayRole || !permDraft) return false;
    return JSON.stringify(permDraft) !== JSON.stringify(displayRole.permissions);
  })();

  const togglePermDraft = (moduleId: string, action: PermissionAction): void => {
    setPermDraft((previousPermissions) => {
      if (!previousPermissions) return previousPermissions;
      const currentActions = previousPermissions[moduleId] || [];
      const updatedActions = currentActions.includes(action)
        ? currentActions.filter((permissionAction) => permissionAction !== action)
        : [...currentActions, action];
      return { ...previousPermissions, [moduleId]: updatedActions };
    });
  };

  const selectAllDraft = (moduleId: string): void => {
    setPermDraft((previousPermissions) =>
      previousPermissions
        ? { ...previousPermissions, [moduleId]: [...PERMISSION_ACTIONS] }
        : previousPermissions,
    );
  };

  const clearAllDraft = (moduleId: string): void => {
    setPermDraft((previousPermissions) =>
      previousPermissions ? { ...previousPermissions, [moduleId]: [] } : previousPermissions,
    );
  };

  const resetPermDraft = (): void => {
    if (displayRole) {
      setPermDraft(structuredClone(displayRole.permissions));
    }
  };

  return {
    permDraft,
    permDirty,
    togglePermDraft,
    selectAllDraft,
    clearAllDraft,
    resetPermDraft,
  };
}
