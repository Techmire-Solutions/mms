import React from "react";
import { AnimatePresence } from "framer-motion";
import type { MessagingTarget } from "../host/useMessageComposerState";
import type { SystemUser } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { AddUserModal } from "./AddUserModal";
import { EditUserModal } from "./EditUserModal";
import { InviteUserModal } from "./InviteUserModal";
import { UserDetail } from "./UserDetail";
import { ResetUserPasswordModal } from "./ResetUserPasswordModal";
import { TenantMessageComposerLauncher } from "../host/TenantMessageComposerLauncher";

export interface UsersModalLayerProps {
  viewing: SystemUser | null;
  editing: SystemUser | null;
  resettingPasswordFor: SystemUser | null;
  showAddUser: boolean;
  showInvite: boolean;
  canWrite: boolean;
  canDelete: boolean;
  users: SystemUser[];
  messagingTarget: MessagingTarget | null;
  onCloseViewing: () => void;
  onCloseEditing: () => void;
  onClosePasswordReset: () => void;
  onCloseAddUser: () => void;
  onCloseInvite: () => void;
  onSaveEdit: (user: SystemUser) => Promise<void>;
  onResetPassword: (user: SystemUser, temporaryPassword: string) => Promise<void>;
  onAddUser: (user: SystemUser) => Promise<void>;
  onInvite: (user: SystemUser) => Promise<void>;
  onRestoreUser: (id: string) => void | Promise<void>;
  onEditFromDetail: (user: SystemUser) => void;
  onCloseComposer: () => void;
}

export function UsersModalLayer({
  viewing,
  editing,
  resettingPasswordFor,
  showAddUser,
  showInvite,
  canWrite,
  canDelete,
  users,
  messagingTarget,
  onCloseViewing,
  onCloseEditing,
  onClosePasswordReset,
  onCloseAddUser,
  onCloseInvite,
  onSaveEdit,
  onResetPassword,
  onAddUser,
  onInvite,
  onRestoreUser,
  onEditFromDetail,
  onCloseComposer,
}: UsersModalLayerProps): React.JSX.Element {
  const existingEmails = showAddUser ? users.map((user) => user.email.toLowerCase()) : [];

  const existingContactIds = showInvite
    ? users.map((user) => user.contactId).filter((id): id is string | number => id != null)
    : [];

  return (
    <>
      <AnimatePresence>
        {viewing ? (
          <ErrorBoundary>
            <UserDetail
              user={viewing}
              onClose={onCloseViewing}
              onEdit={canWrite && !viewing.deletedAt ? onEditFromDetail : undefined}
              canDelete={canDelete}
              onRestore={onRestoreUser}
            />
          </ErrorBoundary>
        ) : null}
        {editing && canWrite ? (
          <ErrorBoundary>
            <EditUserModal user={editing} onClose={onCloseEditing} onSave={onSaveEdit} />
          </ErrorBoundary>
        ) : null}
        {resettingPasswordFor && canWrite ? (
          <ErrorBoundary>
            <ResetUserPasswordModal
              user={resettingPasswordFor}
              onClose={onClosePasswordReset}
              onReset={(temporaryPassword) =>
                onResetPassword(resettingPasswordFor, temporaryPassword)
              }
            />
          </ErrorBoundary>
        ) : null}
        {showAddUser && canWrite ? (
          <ErrorBoundary>
            <AddUserModal
              onClose={onCloseAddUser}
              onAdd={onAddUser}
              existingEmails={existingEmails}
            />
          </ErrorBoundary>
        ) : null}
        {showInvite && canWrite ? (
          <ErrorBoundary>
            <InviteUserModal
              onClose={onCloseInvite}
              onInvite={onInvite}
              existingContactIds={existingContactIds}
            />
          </ErrorBoundary>
        ) : null}
      </AnimatePresence>

      <TenantMessageComposerLauncher messagingTarget={messagingTarget} onClose={onCloseComposer} />
    </>
  );
}
