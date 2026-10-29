import { useState } from "react";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type WorkspaceRole,
} from "@mms/shared";

export function useRolesPermissionDraft(displayRole: WorkspaceRole | null) {
  const [permDraft, setPermDraft] = useState<PermissionMap | null>(null);
  const [permDraftRoleId, setPermDraftRoleId] = useState<string | null>(null);

  // Adjust state during render: the draft mirrors the displayed role until the user edits it.
  if (!displayRole) {
    if (permDraft !== null) setPermDraft(null);
    if (permDraftRoleId !== null) setPermDraftRoleId(null);
  } else if (displayRole.id !== permDraftRoleId) {
    setPermDraft(structuredClone(displayRole.permissions));
    setPermDraftRoleId(displayRole.id);
  }

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
