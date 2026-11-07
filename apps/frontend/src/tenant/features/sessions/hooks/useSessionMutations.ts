import { useQueryClient } from "@tanstack/react-query";
import { tsrClient } from "@/lib/api";
import { assertContractOk } from "@/lib/apiContractError";
import type { Session } from "@/lib/data/sessionsData";
import type { SessionsBulkStatusBody } from "@mms/shared";
import { SESSION_DETAIL_QUERY_KEY } from "@/lib/query/sessionQueryKeys";
import { invalidateSessionDependents } from "@/tenant/features/sessions/hooks/invalidateSessionDependents";

type ContractEnvelope<T> = { status: number; body: T };

/**
 * ts-rest resolves the `{ status, body, headers }` envelope for every status except 401/403.
 * Without an explicit status check a 400/409 would be treated as a successful save — the
 * source of false "saved"/"archived" toasts and the reason the lock-override dialog never
 * opened. Every sessions mutation goes through here.
 */
async function unwrap<T>(request: Promise<unknown>, context: string): Promise<T> {
  const response = (await request) as ContractEnvelope<T>;
  assertContractOk(response, context);
  return response.body;
}

export function useSessionMutations() {
  const queryClient = useQueryClient();

  const invalidate = (options: { enrollments?: boolean; calendar?: boolean } = {}) => {
    invalidateSessionDependents(queryClient, options);
  };

  const create = tsrClient.sessions.create.useMutation({ onSuccess: () => invalidate() });
  const update = tsrClient.sessions.update.useMutation({ onSuccess: () => invalidate() });
  const remove = tsrClient.sessions.delete.useMutation({
    onSuccess: () => invalidate({ calendar: true }),
  });
  const restore = tsrClient.sessions.restore.useMutation({
    onSuccess: () => invalidate({ calendar: true }),
  });
  const bulkDelete = tsrClient.sessions.bulkDelete.useMutation({
    onSuccess: () => invalidate({ calendar: true }),
  });
  const bulkRestore = tsrClient.sessions.bulkRestore.useMutation({
    onSuccess: () => invalidate({ calendar: true }),
  });
  const bulkStatus = tsrClient.sessions.bulkStatus.useMutation({ onSuccess: () => invalidate() });

  return {
    createSession: {
      isPending: create.isPending,
      mutateAsync: async (session: Session): Promise<Session> => {
        const body = await unwrap<{ session: Session }>(
          create.mutateAsync({ body: session }),
          "Failed to create session",
        );
        return body.session;
      },
    },
    updateSession: {
      isPending: update.isPending,
      mutateAsync: async ({ id, session }: { id: string; session: Session }): Promise<Session> => {
        if (session.version === undefined && !session.updatedAt)
          throw new Error("Reload this session before saving — it has no concurrency token");
        const body = await unwrap<{ session: Session }>(
          update.mutateAsync({
            params: { id },
            body: session,
            // OCC: the server 409s instead of silently overwriting a concurrent edit.
            headers: {
              ...(session.version !== undefined
                ? { "x-expected-version": String(session.version) }
                : {}),
              ...(session.updatedAt ? { "x-expected-updated-at": session.updatedAt } : {}),
            },
          }),
          "Failed to update session",
        );
        // Inline tab edits (classes/faculty/fees) must not wait for a detail refetch.
        queryClient.setQueryData([...SESSION_DETAIL_QUERY_KEY, id, "active"], {
          session: body.session,
        });
        return body.session;
      },
    },
    deleteSession: {
      isPending: remove.isPending,
      mutateAsync: async ({
        id,
        deletionReason,
      }: {
        id: string;
        deletionReason?: string;
      }): Promise<void> => {
        await unwrap<{ success: true }>(
          remove.mutateAsync({
            params: { id },
            body: deletionReason ? { deletionReason } : {},
          }),
          "Failed to archive session",
        );
      },
    },
    restoreSession: {
      isPending: restore.isPending,
      mutateAsync: async (id: string): Promise<void> => {
        await unwrap<{ success: true }>(
          restore.mutateAsync({ params: { id }, body: {} }),
          "Failed to restore session",
        );
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
        unwrap<{ succeeded: number; failed: number }>(
          bulkDelete.mutateAsync({
            body: { ids, ...(deletionReason ? { deletionReason } : {}) },
          }),
          "Failed to archive sessions",
        ),
    },
    bulkRestoreSessions: {
      isPending: bulkRestore.isPending,
      mutateAsync: async (ids: string[]): Promise<{ succeeded: number; failed: number }> =>
        unwrap<{ succeeded: number; failed: number }>(
          bulkRestore.mutateAsync({ body: { ids } }),
          "Failed to restore sessions",
        ),
    },
    bulkUpdateSessionStatus: {
      isPending: bulkStatus.isPending,
      mutateAsync: async ({
        ids,
        status,
      }: {
        ids: string[];
        status: string;
      }): Promise<{ succeeded: number; failed: number }> =>
        unwrap<{ succeeded: number; failed: number }>(
          bulkStatus.mutateAsync({
            body: { ids, status: status as SessionsBulkStatusBody["status"] },
          }),
          "Failed to update session status",
        ),
    },
  };
}
