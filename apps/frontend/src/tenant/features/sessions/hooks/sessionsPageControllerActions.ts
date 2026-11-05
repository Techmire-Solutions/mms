import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@/lib/data/sessionsData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { withSessionLockOverride } from "@/tenant/features/sessions/hooks/sessionLockOverridePrompt";

const withReason = (session: Session, lockOverrideReason?: string): Session =>
  (lockOverrideReason ? { ...session, lockOverrideReason } : session) as Session;

interface SessionMutationHandlersDeps {
  t: TranslationFunction;
  editSession: Session | null;
  detailSession: Session | null;
  setDetailSession: (session: Session | null) => void;
  createSession: { mutateAsync: (session: Session) => Promise<Session> };
  updateSession: {
    mutateAsync: (payload: { id: string; session: Session }) => Promise<Session>;
  };
  deleteSession: {
    mutateAsync: (payload: { id: string; deletionReason?: string }) => Promise<void>;
  };
  restoreSession: { mutateAsync: (id: string) => Promise<void> };
  bulkDeleteSessions: {
    mutateAsync: (payload: {
      ids: string[];
      deletionReason?: string;
    }) => Promise<{ succeeded: number; failed: number }>;
  };
  bulkRestoreSessions: {
    mutateAsync: (ids: string[]) => Promise<{ succeeded: number; failed: number }>;
  };
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  /** Sessions setup rights: may override the post-start edit lock with a reason. */
  canOverrideLock?: boolean;
}

export function createSessionSaveHandler(
  deps: Pick<
    SessionMutationHandlersDeps,
    | "t"
    | "editSession"
    | "detailSession"
    | "setDetailSession"
    | "createSession"
    | "updateSession"
    | "canOverrideLock"
  >,
) {
  return async (sessionToSave: Session) => {
    if (deps.editSession?.id) {
      const updated = await withSessionLockOverride(
        Boolean(deps.canOverrideLock),
        (lockOverrideReason) =>
          deps.updateSession.mutateAsync({
            id: sessionToSave.id,
            session: withReason(sessionToSave, lockOverrideReason),
          }),
      );
      notify.success(deps.t("sessions.toast.updated"));
      if (deps.detailSession?.id === sessionToSave.id) deps.setDetailSession(updated);
    } else {
      const created = await deps.createSession.mutateAsync(sessionToSave);
      notify.success(deps.t("sessions.toast.created"));
      deps.setDetailSession(created);
    }
  };
}

export function createSessionUpdateHandler(
  deps: Pick<
    SessionMutationHandlersDeps,
    "t" | "setDetailSession" | "updateSession" | "canOverrideLock"
  >,
) {
  return async (updatedSession: Session) => {
    try {
      const response = await withSessionLockOverride(
        Boolean(deps.canOverrideLock),
        (lockOverrideReason) =>
          deps.updateSession.mutateAsync({
            id: updatedSession.id,
            session: withReason(updatedSession, lockOverrideReason),
          }),
      );
      deps.setDetailSession(response);
      notify.success(deps.t("sessions.toast.updated"));
    } catch (error) {
      notify.error(deps.t("sessions.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function createSessionDeleteHandler(
  deps: Pick<
    SessionMutationHandlersDeps,
    "t" | "detailSession" | "setDetailSession" | "deleteSession" | "restoreSession"
  >,
) {
  return async (id: string, deletionReason?: string) => {
    try {
      await deps.deleteSession.mutateAsync({ id, deletionReason });
      notify.archivedWithUndo(
        deps.t("sessions.toast.deleted"),
        () => {
          void deps.restoreSession
            .mutateAsync(id)
            .then(() => notify.success(deps.t("sessions.toast.restored")))
            .catch((err: unknown) =>
              notify.error(deps.t("settings.serverSaveFailed"), {
                description: err instanceof Error ? err.message : String(err),
              }),
            );
        },
        { undoLabel: deps.t("common.undo"), duration: 8000 },
      );
      if (deps.detailSession?.id === id) deps.setDetailSession(null);
    } catch (err) {
      notify.error(deps.t("settings.serverSaveFailed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

export function createSessionRestoreHandler(
  deps: Pick<SessionMutationHandlersDeps, "t" | "restoreSession">,
) {
  return async (id: string) => {
    try {
      await deps.restoreSession.mutateAsync(id);
      notify.success(deps.t("sessions.toast.restored"));
    } catch (err) {
      notify.error(deps.t("settings.serverSaveFailed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

export function createSessionBulkDeleteHandler(
  deps: Pick<
    SessionMutationHandlersDeps,
    "t" | "bulkDeleteSessions" | "selectedIds" | "setSelectedIds"
  >,
) {
  return async (deletionReason?: string) => {
    try {
      const result = await deps.bulkDeleteSessions.mutateAsync({
        ids: deps.selectedIds,
        deletionReason,
      });
      if (result.failed > 0) {
        notify.error(
          deps.t("sessions.toast.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(deps.t("sessions.toast.deleted"));
      }
      deps.setSelectedIds([]);
    } catch (error) {
      notify.error(deps.t("sessions.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function createSessionBulkRestoreHandler(
  deps: Pick<
    SessionMutationHandlersDeps,
    "t" | "bulkRestoreSessions" | "selectedIds" | "setSelectedIds"
  >,
) {
  return async () => {
    try {
      const result = await deps.bulkRestoreSessions.mutateAsync(deps.selectedIds);
      if (result.failed > 0) {
        notify.error(
          deps.t("sessions.toast.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(deps.t("sessions.toast.restored"));
      }
      deps.setSelectedIds([]);
    } catch (error) {
      notify.error(deps.t("sessions.toast.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function createSessionBulkStatusHandler(
  deps: Pick<SessionMutationHandlersDeps, "t" | "setSelectedIds"> & {
    bulkUpdateSessionStatus: {
      mutateAsync: (payload: {
        ids: string[];
        status: string;
      }) => Promise<{ succeeded: number; failed: number }>;
    };
  },
) {
  return async (ids: string[], status: string) => {
    try {
      const result = await deps.bulkUpdateSessionStatus.mutateAsync({ ids, status });
      if (result.failed > 0) {
        notify.error(
          deps.t("sessions.toast.bulkPartial", {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          ids.length > 1
            ? deps.t("sessions.bulkStatusSuccessMany", { count: ids.length })
            : deps.t("sessions.bulkStatusSuccess"),
        );
      }
      deps.setSelectedIds([]);
    } catch (error) {
      notify.error(deps.t("sessions.toast.bulkStatusFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function toggleFilterValue<T>(
  selectedValues: T[],
  setSelectedValues: Dispatch<SetStateAction<T[]>>,
  nextValue: T,
) {
  setSelectedValues((currentValues) =>
    currentValues.includes(nextValue)
      ? currentValues.filter((selectedValue) => selectedValue !== nextValue)
      : [...currentValues, nextValue],
  );
}
