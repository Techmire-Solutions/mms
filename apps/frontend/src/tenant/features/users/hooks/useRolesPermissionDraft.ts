import { useState } from "react";
import {
  normalizePermissionMap,
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionMap,
  type WorkspaceRole,
} from "@mms/contracts";

export function useRolesPermissionDraft(displayRole: WorkspaceRole | null) {
  const [permDraft, setPermDraft] = useState<PermissionMap | null>(null);
  // Seed identity is the role id **and** its persisted permissions: saving the same
  // role from the role form changes the payload without changing the id, and an
  // id-only reset then left the matrix showing (and re-saving) the pre-save grants.
  const [permDraftSource, setPermDraftSource] = useState<string | null>(null);
  const permDraftSourceKey = displayRole
    ? `${displayRole.id}:${JSON.stringify(displayRole.permissions)}`
    : null;

  // Adjust state during render: the draft mirrors the displayed role until the user edits it.
  if (!displayRole) {
    if (permDraft !== null) setPermDraft(null);
    if (permDraftSource !== null) setPermDraftSource(null);
  } else if (permDraftSourceKey !== permDraftSource) {
    setPermDraft(normalizePermissionMap(displayRole.permissions));
    setPermDraftSource(permDraftSourceKey);
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
      setPermDraft(normalizePermissionMap(displayRole.permissions));
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
