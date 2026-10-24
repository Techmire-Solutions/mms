import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import type { WorkspaceUser, ActivityLog } from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { invalidateUsersQueries } from "./invalidateUsersQueries";

export function useUsersMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateUsersQueries(queryClient);

  const createUser = tsrClient.users.create.useMutation({ onSuccess: invalidate });
  const updateUser = tsrClient.users.update.useMutation({ onSuccess: invalidate });
  const inviteUser = tsrClient.users.invite.useMutation({ onSuccess: invalidate });
  const replaceUsers = tsrClient.users.bulkUpdate.useMutation({ onSuccess: invalidate });
  const replaceLogs = tsrClient.users.activityBulkUpdate.useMutation({ onSuccess: invalidate });
  const deleteUser = tsrClient.users.delete.useMutation({ onSuccess: invalidate });
  const restoreUser = tsrClient.users.restore.useMutation({ onSuccess: invalidate });
  const bulkDeleteUsers = tsrClient.users.bulkDelete.useMutation({ onSuccess: invalidate });
  const bulkRestoreUsers = tsrClient.users.bulkRestore.useMutation({ onSuccess: invalidate });
  const resetPassword = tsrClient.users.resetPassword.useMutation({ onSuccess: invalidate });
  const logExportAudit = tsrClient.users.exportAudit.useMutation();

  return {
    createUser: {
      ...createUser,
      mutate: (user: Record<string, unknown>, opts?: MutateOptions) =>
        createUser.mutate({ body: user }, opts),
      mutateAsync: async (user: Record<string, unknown>) => {
        const res = await createUser.mutateAsync({ body: user });
        if (res.status !== 200)
          throw new Error((res.body as { message?: string })?.message ?? "Failed to create user");
        return res.body.user;
      },
    },
    updateUser: {
      ...updateUser,
      mutate: (input: { id: string; data: Record<string, unknown> }, opts?: MutateOptions) =>
        updateUser.mutate({ params: { id: input.id }, body: input.data }, opts),
      mutateAsync: async (input: { id: string; data: Record<string, unknown> }) => {
        const res = await updateUser.mutateAsync({ params: { id: input.id }, body: input.data });
        if (res.status !== 200)
          throw new Error((res.body as { message?: string })?.message ?? "Failed to update user");
        return res.body.user;
      },
    },
    inviteUser: {
      ...inviteUser,
      mutate: (user: Record<string, unknown>, opts?: MutateOptions) =>
        inviteUser.mutate({ body: user }, opts),
      mutateAsync: async (user: Record<string, unknown>) => {
        const res = await inviteUser.mutateAsync({ body: user });
        if (res.status !== 200)
          throw new Error((res.body as { message?: string })?.message ?? "Failed to invite user");
        return res.body.user;
      },
    },
    replaceUsers: {
      ...replaceUsers,
      mutate: (users: WorkspaceUser[], opts?: MutateOptions) =>
        replaceUsers.mutate({ body: users }, opts),
      mutateAsync: (users: WorkspaceUser[]) => replaceUsers.mutateAsync({ body: users }),
    },
    replaceLogs: {
      ...replaceLogs,
      mutate: (logs: ActivityLog[], opts?: MutateOptions) =>
        replaceLogs.mutate({ body: logs }, opts),
      mutateAsync: (logs: ActivityLog[]) => replaceLogs.mutateAsync({ body: logs }),
    },
    deleteUser: {
      ...deleteUser,
      mutate: (id: string, opts?: MutateOptions) =>
        deleteUser.mutate({ params: { id }, body: {} }, opts),
      mutateAsync: (id: string) => deleteUser.mutateAsync({ params: { id }, body: {} }),
    },
    restoreUser: {
      ...restoreUser,
      mutate: (id: string, opts?: MutateOptions) =>
        restoreUser.mutate({ params: { id }, body: {} }, opts),
      mutateAsync: (id: string) => restoreUser.mutateAsync({ params: { id }, body: {} }),
    },
    bulkDeleteUsers: {
      ...bulkDeleteUsers,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkDeleteUsers.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkDeleteUsers.mutateAsync({ body: { ids } }),
    },
    bulkRestoreUsers: {
      ...bulkRestoreUsers,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkRestoreUsers.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkRestoreUsers.mutateAsync({ body: { ids } }),
    },
    resetPassword: {
      ...resetPassword,
      mutateAsync: async (input: { userId: string; temporaryPassword: string }) => {
        const response = await resetPassword.mutateAsync({
          params: { id: input.userId },
          body: { temporaryPassword: input.temporaryPassword },
        });
        if (response.status !== 200)
          throw new Error((response.body as { message?: string })?.message ?? "");
        return response.body;
      },
    },
    logExportAudit: {
      ...logExportAudit,
      mutate: (payload: { count: number; scope: string }, opts?: MutateOptions) =>
        logExportAudit.mutate({ body: payload }, opts),
      mutateAsync: (payload: { count: number; scope: string }) =>
        logExportAudit.mutateAsync({ body: payload }),
    },
  };
}
