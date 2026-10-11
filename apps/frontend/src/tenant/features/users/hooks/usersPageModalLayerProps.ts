import type { SystemUser } from "@mms/shared";
import type { MessagingTarget } from "@/hooks/useMessageComposerState";
import type { UsersModalLayerProps } from "@/tenant/features/users/components/UsersModalLayer";
import type { useUsersPageActions } from "@/tenant/features/users/hooks/useUsersPageActions";

export interface BuildUsersModalLayerSource {
  viewing: SystemUser | null;
  editing: SystemUser | null;
  resettingPasswordFor: SystemUser | null;
  showAddUser: boolean;
  showInvite: boolean;
  canWrite: boolean;
  canDelete: boolean;
  users: SystemUser[];
  messagingTarget: MessagingTarget | null;
  actions: ReturnType<typeof useUsersPageActions>;
  setViewing: (user: SystemUser | null) => void;
  setEditing: (user: SystemUser | null) => void;
  setResettingPasswordFor: (user: SystemUser | null) => void;
  setShowAddUser: (open: boolean) => void;
  setShowInvite: (open: boolean) => void;
  handleOpenEdit: (user: SystemUser) => void;
  closeComposer: () => void;
}

/**
 * Assembles standard Modal Layer props from controller domain slices.
 */
export function buildUsersModalLayerProps(
  source: BuildUsersModalLayerSource,
): UsersModalLayerProps {
  const { actions } = source;

  return {
    viewing: source.viewing,
    editing: source.editing,
    resettingPasswordFor: source.resettingPasswordFor,
    showAddUser: source.showAddUser,
    showInvite: source.showInvite,
    canWrite: source.canWrite,
    canDelete: source.canDelete,
    users: source.users,
    messagingTarget: source.messagingTarget,
    onCloseViewing: () => source.setViewing(null),
    onCloseEditing: () => source.setEditing(null),
    onClosePasswordReset: () => source.setResettingPasswordFor(null),
    onCloseAddUser: () => source.setShowAddUser(false),
    onCloseInvite: () => source.setShowInvite(false),
    onSaveEdit: actions.handleSaveEdit,
    onResetPassword: actions.handleResetPassword,
    onAddUser: actions.handleAddUser,
    onInvite: actions.handleInvite,
    onRestoreUser: (id) => {
      void actions.handleRestoreUser(id);
    },
    onEditFromDetail: (user) => {
      source.setViewing(null);
      source.handleOpenEdit(user);
    },
    onCloseComposer: source.closeComposer,
  };
}
