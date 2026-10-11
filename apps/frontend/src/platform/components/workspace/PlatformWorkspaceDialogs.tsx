import React from "react";
import { PlatformWorkspaceDeleteDialog } from "@/platform/components/PlatformWorkspaceDeleteDialog";
import { PlatformWorkspaceModulesDialog } from "@/platform/components/PlatformWorkspaceModulesDialog";
import { PlatformWorkspaceResetPasswordDialog } from "@/platform/components/PlatformWorkspaceResetPasswordDialog";
import { PlatformWorkspaceCreateAdminDialog } from "@/platform/components/PlatformWorkspaceCreateAdminDialog";
import {
  useResetWorkspaceAdminPassword,
  useCreateWorkspaceAdmin,
} from "@/platform/hooks/usePlatformWorkspaces";
import { Drawer } from "@/components/ui/Drawer";
import { EntityDescriptorSections } from "@/components/ui/EntityDescriptorSections";
import type { EntityDescriptor } from "@/types/entityRegistry";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import type { useWorkspaceDeleteState } from "@/platform/components/workspace/useWorkspaceDeleteState";
import type { usePlatformWorkspaceModalState } from "@/platform/components/workspace/usePlatformWorkspaceModalState";

export interface PlatformWorkspaceDialogsProps {
  appDomain: string;
  deleteState: ReturnType<typeof useWorkspaceDeleteState>;
  modalState: ReturnType<typeof usePlatformWorkspaceModalState>;
  descriptor?: EntityDescriptor<PlatformWorkspaceRowData>;
}

export function PlatformWorkspaceDialogs({
  appDomain,
  deleteState,
  modalState,
  descriptor,
}: PlatformWorkspaceDialogsProps): React.JSX.Element {
  const {
    confirmOpen,
    setConfirmOpen,
    targetWorkspace,
    password,
    setPassword,
    confirmSubdomain,
    setConfirmSubdomain,
    passwordError,
    deletePending,
    handleDelete: onDelete,
  } = deleteState;

  const {
    modulesOpen,
    setModulesOpen,
    targetModulesWorkspace,
    resetPasswordOpen,
    setResetPasswordOpen,
    targetResetWorkspace,
    createAdminOpen,
    setCreateAdminOpen,
    targetCreateWorkspace,
  } = modalState;

  const resetAdminPasswordMutation = useResetWorkspaceAdminPassword();
  const createAdminMutation = useCreateWorkspaceAdmin();
  const inspect = modalState.inspectWorkspace;

  return (
    <>
      {targetWorkspace ? (
        <PlatformWorkspaceDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          workspace={targetWorkspace}
          appDomain={appDomain}
          password={password}
          onPasswordChange={setPassword}
          confirmSubdomain={confirmSubdomain}
          onConfirmSubdomainChange={setConfirmSubdomain}
          passwordError={passwordError}
          deletePending={deletePending}
          onConfirm={onDelete}
        />
      ) : null}

      {targetModulesWorkspace ? (
        <PlatformWorkspaceModulesDialog
          workspace={targetModulesWorkspace}
          open={modulesOpen}
          onOpenChange={setModulesOpen}
        />
      ) : null}

      {targetResetWorkspace ? (
        <PlatformWorkspaceResetPasswordDialog
          open={resetPasswordOpen}
          onOpenChange={setResetPasswordOpen}
          workspace={targetResetWorkspace}
          resetPending={resetAdminPasswordMutation.isPending}
          onConfirm={async (subdomain, data) => {
            const res = await resetAdminPasswordMutation.mutateAsync({ subdomain, ...data });
            return { newPassword: res.newPassword, adminEmail: res.adminEmail };
          }}
        />
      ) : null}

      {targetCreateWorkspace ? (
        <PlatformWorkspaceCreateAdminDialog
          open={createAdminOpen}
          onOpenChange={setCreateAdminOpen}
          workspace={targetCreateWorkspace}
          createPending={createAdminMutation.isPending}
          onConfirm={async (subdomain, data) => {
            const res = await createAdminMutation.mutateAsync({ subdomain, ...data });
            return {
              initialPassword: res.initialPassword,
              adminEmail: res.adminEmail,
              name: res.name,
            };
          }}
        />
      ) : null}

      <Drawer
        open={Boolean(inspect)}
        onClose={modalState.handleCloseInspect}
        title={inspect?.madrasaName ?? "Workspace"}
      >
        {inspect ? (
          <EntityDescriptorSections
            entity={inspect}
            entityType="platformWorkspaces"
            descriptor={descriptor}
          />
        ) : null}
      </Drawer>
    </>
  );
}
