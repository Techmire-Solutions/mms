import { useQueryClient } from "@tanstack/react-query";
import type { MutateOptions } from "@tanstack/react-query";
import { tsrClient } from "@/lib/api";
import type { Session } from "@/lib/data/sessionsData";
import { invalidateSessionsQueries } from "@/tenant/features/sessions/hooks/invalidateSessionsQueries";

export function useSessionMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    invalidateSessionsQueries(queryClient);
  };

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const createSession = tsrClient.sessions.create.useMutation({
    onSuccess: invalidate,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const updateSession = tsrClient.sessions.update.useMutation({
    onSuccess: invalidate,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const deleteSession = tsrClient.sessions.delete.useMutation({
    onSuccess: invalidate,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const restoreSession = tsrClient.sessions.restore.useMutation({
    onSuccess: invalidate,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const bulkDeleteSessions = tsrClient.sessions.bulkDelete.useMutation({
    onSuccess: invalidate,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const bulkRestoreSessions = tsrClient.sessions.bulkRestore.useMutation({
    onSuccess: invalidate,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const bulkUpdateSessionStatus = tsrClient.sessions.bulkStatus.useMutation({
    onSuccess: invalidate,
  });

  // @ts-expect-error - TS union discrimination limit with ts-rest
  const logExportAudit = tsrClient.sessions.exportAudit.useMutation({});

  return {
    createSession: {
      ...createSession,
      mutate: (session: Session, opts?: MutateOptions) =>
        createSession.mutate({ body: session }, opts),
      mutateAsync: (session: Session) => createSession.mutateAsync({ body: session }),
    },
    updateSession: {
      ...updateSession,
      mutate: ({ id, session }: { id: string; session: Session }, opts?: MutateOptions) =>
        updateSession.mutate({ params: { id }, body: session }, opts),
      mutateAsync: ({ id, session }: { id: string; session: Session }) =>
        updateSession.mutateAsync({ params: { id }, body: session }),
    },
    deleteSession: {
      ...deleteSession,
      mutate: (
        { id, deletionReason }: { id: string; deletionReason?: string },
        opts?: MutateOptions,
      ) =>
        deleteSession.mutate(
          { params: { id }, body: deletionReason ? { deletionReason } : {} },
          opts,
        ),
      mutateAsync: ({ id, deletionReason }: { id: string; deletionReason?: string }) =>
        deleteSession.mutateAsync({
          params: { id },
          body: deletionReason ? { deletionReason } : {},
        }),
    },
    restoreSession: {
      ...restoreSession,
      mutate: (id: string, opts?: MutateOptions) =>
        restoreSession.mutate({ params: { id }, body: {} }, opts),
      mutateAsync: (id: string) => restoreSession.mutateAsync({ params: { id }, body: {} }),
    },
    bulkDeleteSessions: {
      ...bulkDeleteSessions,
      mutate: (
        { ids, deletionReason }: { ids: string[]; deletionReason?: string },
        opts?: MutateOptions,
      ) =>
        bulkDeleteSessions.mutate(
          { body: { ids, ...(deletionReason ? { deletionReason } : {}) } },
          opts,
        ),
      mutateAsync: ({ ids, deletionReason }: { ids: string[]; deletionReason?: string }) =>
        bulkDeleteSessions.mutateAsync({
          body: { ids, ...(deletionReason ? { deletionReason } : {}) },
        }),
    },
    bulkRestoreSessions: {
      ...bulkRestoreSessions,
      mutate: (ids: string[], opts?: MutateOptions) =>
        bulkRestoreSessions.mutate({ body: { ids } }, opts),
      mutateAsync: (ids: string[]) => bulkRestoreSessions.mutateAsync({ body: { ids } }),
    },
    bulkUpdateSessionStatus: {
      ...bulkUpdateSessionStatus,
      mutate: ({ ids, status }: { ids: string[]; status: string }, opts?: MutateOptions) =>
        bulkUpdateSessionStatus.mutate({ body: { ids, status } }, opts),
      mutateAsync: ({ ids, status }: { ids: string[]; status: string }) =>
        bulkUpdateSessionStatus.mutateAsync({ body: { ids, status } }),
    },
    logExportAudit: {
      ...logExportAudit,
      mutate: (
        payload: { count: number; scope: "all" | "filtered" | "selection" },
        opts?: MutateOptions,
      ) => logExportAudit.mutate({ body: payload }, opts),
      mutateAsync: (payload: { count: number; scope: "all" | "filtered" | "selection" }) =>
        logExportAudit.mutateAsync({ body: payload }),
    },
  };
}
