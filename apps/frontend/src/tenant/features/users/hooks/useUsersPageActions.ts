import type { SystemUser } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { useUsersMutations } from "@/tenant/features/users/hooks/useUsersApi";

interface UseUsersPageActionsParams {
  actorId?: string;
  t: TranslationFunction;
}

export function useUsersPageActions({ actorId: _actorId, t }: UseUsersPageActionsParams) {
  const {
    createUser,
    updateUser,
    inviteUser,
    deleteUser,
    restoreUser,
    bulkDeleteUsers,
    bulkRestoreUsers,
    resetPassword,
  } = useUsersMutations();

  const handleDeleteUser = async (id: string): Promise<void> => {
    try {
      await deleteUser.mutateAsync(id);
      notify.success(t("users.trash.deleted"));
    } catch (error: unknown) {
      notify.error(t("users.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRestoreUser = async (id: string): Promise<void> => {
    try {
      await restoreUser.mutateAsync(id);
      notify.success(t("users.trash.restored"));
    } catch (error: unknown) {
      notify.error(t("users.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleBulkDelete = async (ids: string[]): Promise<void> => {
    try {
      const result = await bulkDeleteUsers.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("users.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(t("users.trash.deleted"));
      }
    } catch (error: unknown) {
      notify.error(t("users.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleBulkRestore = async (ids: string[]): Promise<void> => {
    try {
      const result = await bulkRestoreUsers.mutateAsync(ids);
      if (result.failed > 0) {
        notify.warning(
          t("users.trash.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(t("users.trash.restored"));
      }
    } catch (error: unknown) {
      notify.error(t("users.trash.actionFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleResetPassword = async (
    user: SystemUser,
    temporaryPassword: string,
  ): Promise<void> => {
    await resetPassword.mutateAsync({ userId: user.id, temporaryPassword });
    notify.success(t("users.resetPasswordToast"), {
      description: t("users.resetPasswordToastDesc", { name: user.name }),
    });
  };

  const handleSaveEdit = async (updated: SystemUser): Promise<void> => {
    await updateUser.mutateAsync({ id: updated.id, data: Object.assign({}, updated) });
    notify.success(t("users.saveChanges"));
  };

  const notifyUserCreated = (result: unknown): void => {
    const body = (
      result as { body?: { inviteEmailSent?: boolean; inviteEmailError?: string } } | undefined
    )?.body;
    if (body?.inviteEmailSent === false) {
      notify.warning(t("users.inviteEmailFailedTitle"), {
        description: body.inviteEmailError || t("users.inviteEmailFailedDesc"),
      });
      return;
    }
    notify.success(t("users.addSuccessTitle"));
  };

  const handleInvite = async (user: SystemUser): Promise<void> => {
    const result = await inviteUser.mutateAsync(Object.assign({}, user));
    notifyUserCreated(result);
  };

  const handleAddUser = async (user: SystemUser): Promise<void> => {
    const result = await createUser.mutateAsync(Object.assign({}, user));
    notifyUserCreated(result);
  };

  return {
    handleDeleteUser,
    handleRestoreUser,
    handleBulkDelete,
    handleBulkRestore,
    handleResetPassword,
    handleSaveEdit,
    handleInvite,
    handleAddUser,
  };
}
