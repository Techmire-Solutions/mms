import React, { useEffect } from "react";
import { Shield, Lock } from "lucide-react";
import { workspaceRoleLabel } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";

import { PermissionMatrix } from "@/tenant/features/users/components/PermissionMatrix";
import { RoleFormModal } from "@/tenant/features/users/components/RoleFormModal";
import { RolesListSidebar } from "@/tenant/features/users/components/RolesListSidebar";
import { useRolesPermissionsController } from "@/tenant/features/users/hooks/useRolesPermissionsController";
import { Badge } from "@/components/ui/badge";

export interface RolesPermissionsProps {
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterDiscard?: (discard: () => void) => void;
}

export function RolesPermissions({
  onDirtyChange,
  onRegisterDiscard,
}: RolesPermissionsProps = {}): React.JSX.Element {
  const {
    t,
    isAdmin,
    isSuperAdmin,
    canManageRole,
    canManageDisplayRole,
    canAccessRolesAndPermissions,
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
    togglePermDraft,
    selectAllDraft,
    clearAllDraft,
    resetPermDraft,
    handleSave,
    savePermissionDraft,
    editTitle,
  } = useRolesPermissionsController();

  useEffect(() => {
    onDirtyChange?.(permDirty);
  }, [permDirty, onDirtyChange]);

  useEffect(() => {
    onRegisterDiscard?.(resetPermDraft);
    return () => {
      onDirtyChange?.(false);
    };
  }, [onRegisterDiscard, resetPermDraft, onDirtyChange]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <RolesListSidebar
          roles={roles}
          displayRole={displayRole}
          isAdmin={isAdmin}
          requestSelectRole={requestSelectRole}
          requestEditRole={requestEditRole}
          t={t}
        />

        <div className="space-y-3 lg:col-span-2">
          {displayRole && permDraft ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold text-foreground">
                    {t("users.permissions.matrixTitle", {
                      name: workspaceRoleLabel(displayRole, t),
                    })}
                  </p>
                  {displayRole.isSystem ? (
                    <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
                  ) : null}
                  {displayRole.id === "super_admin" && !isSuperAdmin ? (
                    <Badge as="span" tone="primary" size="sm">
                      {t("users.permissions.superAdminProtectedBadge")}
                    </Badge>
                  ) : null}
                </div>
                {canManageDisplayRole ? (
                  <div className="flex items-center gap-2">
                    {permDirty ? (
                      <Badge as="span" tone="warning" size="sm">
                        {t("users.permissions.unsaved")}
                      </Badge>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!permDirty}
                      onClick={resetPermDraft}
                    >
                      {t("users.permissions.resetPermissions")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!permDirty}
                      onClick={savePermissionDraft}
                    >
                      {t("users.permissions.savePermissions")}
                    </Button>
                  </div>
                ) : null}
              </div>
              {canManageDisplayRole ? (
                <p className="text-xs text-muted-foreground">{t("users.permissions.editHint")}</p>
              ) : displayRole.id === "super_admin" ? (
                <p className="text-xs text-muted-foreground">
                  {t("users.permissions.superAdminProtected")}
                </p>
              ) : null}
              <PermissionMatrix
                modules={visibleModules}
                perms={permDraft}
                readOnly={!canManageDisplayRole}
                onToggle={togglePermDraft}
                onSelectAll={selectAllDraft}
                onClearAll={clearAllDraft}
              />
            </>
          ) : null}
        </div>
      </div>

      <RoleFormModal
        open={!!editing}
        onClose={closeRoleForm}
        title={editTitle}
        role={editing === "new" ? null : editing}
        visibleModules={visibleModules}
        onSave={handleSave}
      />

      <ConfirmAlertDialog
        open={pendingMatrixLeave !== null}
        onOpenChange={(open) => {
          if (!open) clearPendingMatrixLeave();
        }}
        title={t("settings.unsavedChanges")}
        description={t("users.permissions.discardUnsavedMatrixConfirm")}
        confirmLabel={t("common.yes")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={confirmPendingMatrixLeave}
      />
    </div>
  );
}
