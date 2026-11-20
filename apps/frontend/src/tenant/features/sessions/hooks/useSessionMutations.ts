import { mutationOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import type { Session } from "@/lib/data/sessionsData";
import type { SessionsBulkStatusBody } from "@mms/shared";
import { SESSION_DETAIL_QUERY_KEY } from "@/lib/query/sessionQueryKeys";
import { invalidateSessionDependents } from "@/tenant/features/sessions/hooks/invalidateSessionDependents";

/**
 * ts-rest resolves the `{ status, body, headers }` envelope for every status except 401/403.
 * Without an explicit status check a 400/409 would be treated as a successful save — the
 * source of false "saved"/"archived" toasts and the reason the lock-override dialog never
 * opened. Every sessions mutation goes through `assertContractOk`.
 */
async function call<T>(
  request: Promise<{ status: number; body: unknown }>,
  context: string,
): Promise<T> {
  const response = await request;
  assertContractOk(response, context);
  return response.body as T;
}

/** Colocated mutation factories (single source of truth), matching the module convention. */
export function createSessionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "create"] as const,
    mutationFn: async (session: Session): Promise<Session> =>
      (
        await call<{ session: Session }>(
          apiContract.sessions.create({ body: session }),
          "Failed to create session",
        )
      ).session,
  });
}

export function updateSessionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "update"] as const,
    mutationFn: async ({ id, session }: { id: string; session: Session }): Promise<Session> => {
      if (session.version === undefined && !session.updatedAt)
        throw new Error("Reload this session before saving — it has no concurrency token");
      return (
        await call<{ session: Session }>(
          apiContract.sessions.update({
            params: { id },
            body: session,
            // OCC: the server 409s instead of silently overwriting a concurrent edit.
            extraHeaders: {
              ...(session.version !== undefined
                ? { "x-expected-version": String(session.version) }
                : {}),
              ...(session.updatedAt ? { "x-expected-updated-at": session.updatedAt } : {}),
            },
          }),
          "Failed to update session",
        )
      ).session;
    },
  });
}

export function deleteSessionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "delete"] as const,
    mutationFn: async ({ id, deletionReason }: { id: string; deletionReason?: string }) => {
      await call<{ success: true }>(
        apiContract.sessions.delete({
          params: { id },
          body: deletionReason ? { deletionReason } : {},
        }),
        "Failed to archive session",
      );
    },
  });
}

export function restoreSessionMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "restore"] as const,
    mutationFn: async (id: string) => {
      await call<{ success: true }>(
        apiContract.sessions.restore({ params: { id }, body: {} }),
        "Failed to restore session",
      );
    },
  });
}

export function bulkDeleteSessionsMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "bulk-delete"] as const,
    mutationFn: async ({ ids, deletionReason }: { ids: string[]; deletionReason?: string }) =>
      call<{ succeeded: number; failed: number }>(
        apiContract.sessions.bulkDelete({
          body: { ids, ...(deletionReason ? { deletionReason } : {}) },
        }),
        "Failed to archive sessions",
      ),
  });
}

export function bulkRestoreSessionsMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "bulk-restore"] as const,
    mutationFn: async (ids: string[]) =>
      call<{ succeeded: number; failed: number }>(
        apiContract.sessions.bulkRestore({ body: { ids } }),
        "Failed to restore sessions",
      ),
  });
}

export function bulkStatusSessionsMutationOptions() {
  return mutationOptions({
    mutationKey: ["sessions", "bulk-status"] as const,
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) =>
      call<{ succeeded: number; failed: number }>(
        apiContract.sessions.bulkStatus({
          body: { ids, status: status as SessionsBulkStatusBody["status"] },
        }),
        "Failed to update session status",
      ),
  });
}

export function useSessionMutations() {
  const queryClient = useQueryClient();

  const invalidate = (options: { enrollments?: boolean; calendar?: boolean } = {}) => {
    invalidateSessionDependents(queryClient, options);
  };

  const create = useMutation({ ...createSessionMutationOptions(), onSuccess: () => invalidate() });
  const update = useMutation({ ...updateSessionMutationOptions(), onSuccess: () => invalidate() });
  const remove = useMutation({
    ...deleteSessionMutationOptions(),
    onSuccess: () => invalidate({ calendar: true }),
  });
  const restore = useMutation({
    ...restoreSessionMutationOptions(),
    onSuccess: () => invalidate({ calendar: true }),
  });
  const bulkDelete = useMutation({
    ...bulkDeleteSessionsMutationOptions(),
    onSuccess: () => invalidate({ calendar: true }),
  });
  const bulkRestore = useMutation({
    ...bulkRestoreSessionsMutationOptions(),
    onSuccess: () => invalidate({ calendar: true }),
  });
  const bulkStatus = useMutation({
    ...bulkStatusSessionsMutationOptions(),
    onSuccess: () => invalidate(),
  });

  return {
    createSession: {
      isPending: create.isPending,
      mutateAsync: async (session: Session): Promise<Session> => create.mutateAsync(session),
    },
    updateSession: {
      isPending: update.isPending,
      mutateAsync: async ({ id, session }: { id: string; session: Session }): Promise<Session> => {
        const saved = await update.mutateAsync({ id, session });
        // Inline tab edits (classes/faculty/fees) must not wait for a detail refetch.
        queryClient.setQueryData([...SESSION_DETAIL_QUERY_KEY, id, "active"], {
          session: saved,
        });
        return saved;
      },
    },
    deleteSession: {
      isPending: remove.isPending,
      mutateAsync: async ({ id, deletionReason }: { id: string; deletionReason?: string }) => {
        await remove.mutateAsync({ id, deletionReason });
      },
    },
    restoreSession: {
      isPending: restore.isPending,
      mutateAsync: async (id: string) => {
        await restore.mutateAsync(id);
      },
    },
    bulkDeleteSessions: {
      isPending: bulkDelete.isPending,
      mutateAsync: async ({
        ids,
        deletionReason,
      }: {
        ids: string[];
        deletionReason?: string;
      }): Promise<{ succeeded: number; failed: number }> =>
        bulkDelete.mutateAsync({ ids, deletionReason }),
    },
    bulkRestoreSessions: {
      isPending: bulkRestore.isPending,
      mutateAsync: async (ids: string[]): Promise<{ succeeded: number; failed: number }> =>
        bulkRestore.mutateAsync(ids),
    },
    bulkUpdateSessionStatus: {
      isPending: bulkStatus.isPending,
      mutateAsync: async ({
        ids,
        status,
      }: {
        ids: string[];
        status: string;
      }): Promise<{ succeeded: number; failed: number }> => bulkStatus.mutateAsync({ ids, status }),
    },
  };
}
