import { useState } from "react";
import { canManageTargetUser, type SystemUser } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { notify } from "@/lib/notify";
import { buildUsersModalLayerProps } from "./usersPageModalLayerProps";
import type { useUsersPageActions } from "./useUsersPageActions";

export interface UseUsersModalLayerOptions {
  authUser: { id?: string; role?: string } | null;
  canWrite: boolean;
  canDelete: boolean;
  users: SystemUser[];
  actions: ReturnType<typeof useUsersPageActions>;
  t: TranslationFunction;
}

export function useUsersModalLayer({
  authUser,
  canWrite,
  canDelete,
  users,
  actions,
  t,
}: UseUsersModalLayerOptions) {
  const [viewing, setViewing] = useState<SystemUser | null>(null);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [resettingPasswordFor, setResettingPasswordFor] = useState<SystemUser | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  const actorId = authUser?.id ?? "system";

  const handleOpenEdit = (user: SystemUser): void => {
    if (!canManageTargetUser(authUser?.role, user.role)) {
      notify.error(t("users.errors.cannotModifySuperAdmin"));
      return;
    }
    setEditing(user);
  };

  const handleOpenPasswordReset = (user: SystemUser): void => {
    if (user.id === actorId) {
      notify.info(t("users.resetPasswordSelfTitle"), {
        description: t("users.resetPasswordSelfDescription"),
      });
      return;
    }
    if (!canManageTargetUser(authUser?.role, user.role)) {
      notify.error(t("users.errors.cannotResetSuperAdminPassword"));
      return;
    }
    setResettingPasswordFor(user);
  };

  const { messagingTarget, openComposer, closeComposer } = useMessageComposerState();

  const handleMessageUsers = (channel: "sms" | "whatsapp" | "email", targetUsers: SystemUser[]) => {
    openComposer(
      channel,
      targetUsers.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone || "",
        email: u.email || "",
      })),
    );
  };

  const handleOpenAddUser = () => setShowAddUser(true);
  const handleOpenInviteUser = () => setShowInvite(true);

  const modalLayerProps = buildUsersModalLayerProps({
    viewing,
    editing,
    resettingPasswordFor,
    showAddUser,
    showInvite,
    canWrite,
    canDelete,
    users,
    messagingTarget,
    actions,
    setViewing,
    setEditing,
    setResettingPasswordFor,
    setShowAddUser,
    setShowInvite,
    handleOpenEdit,
    closeComposer,
  });

  return {
    viewing,
    setViewing,
    editing,
    setEditing,
    resettingPasswordFor,
    setResettingPasswordFor,
    showAddUser,
    setShowAddUser,
    showInvite,
    setShowInvite,
    handleOpenEdit,
    handleOpenPasswordReset,
    handleOpenAddUser,
    handleOpenInviteUser,
    handleMessageUsers,
    modalLayerProps,
  };
}
