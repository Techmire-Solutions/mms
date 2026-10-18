import type { Dispatch, SetStateAction } from 'react';
import type { Session } from '@/lib/data/sessionsData';
import type { TranslationFunction } from '@/lib/contexts/TranslationContext';
import { notify } from '@/lib/notify';
import { withSessionLockOverride } from '@/tenant/features/sessions/hooks/sessionLockOverridePrompt';

const withReason = (session: Session, lockOverrideReason?: string): Session =>
  (lockOverrideReason ? { ...session, lockOverrideReason } : session) as Session;

interface SessionMutationHandlersDeps {
  t: TranslationFunction;
  editSession: Session | null;
  detailSession: Session | null;
  setDetailSession: (session: Session | null) => void;
  createSession: { mutateAsync: (session: Session) => Promise<{ session?: Session }> };
  updateSession: { mutateAsync: (payload: { id: string; session: Session }) => Promise<{ session?: Session }> };
  deleteSession: {
    mutate: (
      payload: { id: string; deletionReason?: string },
      options: { onSuccess?: () => void; onError?: (err: unknown) => void },
    ) => void;
  };
  restoreSession: { mutate: (id: string, options: { onSuccess?: () => void; onError?: (err: unknown) => void }) => void };
  bulkDeleteSessions: {
    mutate: (
      payload: { ids: string[]; deletionReason?: string },
      options: { onSuccess?: (result: { succeeded: number; failed: number }) => void; onError?: (error: unknown) => void },
    ) => void;
  };
  bulkRestoreSessions: { mutate: (ids: string[], options: { onSuccess?: (result: { succeeded: number; failed: number }) => void; onError?: (error: unknown) => void }) => void };
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  /** Sessions setup rights: may override the post-start edit lock with a reason. */
  canOverrideLock?: boolean;
}

export function createSessionSaveHandler(deps: Pick<SessionMutationHandlersDeps, 't' | 'editSession' | 'detailSession' | 'setDetailSession' | 'createSession' | 'updateSession' | 'canOverrideLock'>) {
  return async (sessionToSave: Session) => {
    if (deps.editSession?.id) {
      await withSessionLockOverride(Boolean(deps.canOverrideLock), (lockOverrideReason) =>
        deps.updateSession.mutateAsync({ id: sessionToSave.id, session: withReason(sessionToSave, lockOverrideReason) }));
      notify.success(deps.t('sessions.toast.updated'));
      if (deps.detailSession?.id === sessionToSave.id) deps.setDetailSession(sessionToSave);
    } else {
      const created = await deps.createSession.mutateAsync(sessionToSave);
      notify.success(deps.t('sessions.toast.created'));
      if (created.session) deps.setDetailSession(created.session);
    }
  };
}

export function createSessionUpdateHandler(deps: Pick<SessionMutationHandlersDeps, 't' | 'setDetailSession' | 'updateSession' | 'canOverrideLock'>) {
  return async (updatedSession: Session) => {
    try {
      const response = await withSessionLockOverride(Boolean(deps.canOverrideLock), (lockOverrideReason) =>
        deps.updateSession.mutateAsync({ id: updatedSession.id, session: withReason(updatedSession, lockOverrideReason) }));
      deps.setDetailSession(response.session ?? updatedSession);
      notify.success(deps.t('sessions.toast.updated'));
    } catch (error) {
      notify.error(deps.t('sessions.toast.saveFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function createSessionDeleteHandler(deps: Pick<SessionMutationHandlersDeps, 't' | 'detailSession' | 'setDetailSession' | 'deleteSession' | 'restoreSession'>) {
  return (id: string, deletionReason?: string) => {
    deps.deleteSession.mutate({ id, deletionReason }, {
      onSuccess: () => {
        notify.archivedWithUndo(
          deps.t('sessions.toast.deleted'),
          () => {
            deps.restoreSession.mutate(id, {
              onSuccess: () => notify.success(deps.t('sessions.toast.restored')),
              onError: (err) => notify.error(deps.t('settings.serverSaveFailed'), {
                description: err instanceof Error ? err.message : String(err),
              }),
            });
          },
          { undoLabel: deps.t('common.undo'), duration: 8000 },
        );
        if (deps.detailSession?.id === id) deps.setDetailSession(null);
      },
      onError: (err) => notify.error(deps.t('settings.serverSaveFailed'), {
        description: err instanceof Error ? err.message : String(err),
      }),
    });
  };
}

export function createSessionRestoreHandler(deps: Pick<SessionMutationHandlersDeps, 't' | 'restoreSession'>) {
  return (id: string) => {
    deps.restoreSession.mutate(id, {
      onSuccess: () => notify.success(deps.t('sessions.toast.restored')),
      onError: (err) => notify.error(deps.t('settings.serverSaveFailed'), {
        description: err instanceof Error ? err.message : String(err),
      }),
    });
  };
}

export function createSessionBulkDeleteHandler(deps: Pick<SessionMutationHandlersDeps, 't' | 'bulkDeleteSessions' | 'selectedIds' | 'setSelectedIds'>) {
  return (deletionReason?: string) => {
    deps.bulkDeleteSessions.mutate({ ids: deps.selectedIds, deletionReason }, {
      onSuccess: (result) => {
        if (result.failed > 0) {
          notify.error(deps.t('sessions.toast.bulkPartial', {
            succeeded: result.succeeded,
            failed: result.failed,
          }));
        } else {
          notify.success(deps.t('sessions.toast.deleted'));
        }
        deps.setSelectedIds([]);
      },
      onError: (error) => notify.error(deps.t('sessions.toast.saveFailed'), {
        description: error instanceof Error ? error.message : String(error),
      }),
    });
  };
}

export function createSessionBulkRestoreHandler(deps: Pick<SessionMutationHandlersDeps, 't' | 'bulkRestoreSessions' | 'selectedIds' | 'setSelectedIds'>) {
  return () => {
    deps.bulkRestoreSessions.mutate(deps.selectedIds, {
      onSuccess: (result) => {
        if (result.failed > 0) {
          notify.error(deps.t('sessions.toast.bulkPartial', {
            succeeded: result.succeeded,
            failed: result.failed,
          }));
        } else {
          notify.success(deps.t('sessions.toast.restored'));
        }
        deps.setSelectedIds([]);
      },
      onError: (error) => notify.error(deps.t('sessions.toast.saveFailed'), {
        description: error instanceof Error ? error.message : String(error),
      }),
    });
  };
}

export function createSessionBulkStatusHandler(
  deps: Pick<SessionMutationHandlersDeps, 't' | 'setSelectedIds'> & {
    bulkUpdateSessionStatus: {
      mutateAsync: (payload: { ids: string[]; status: string }) => Promise<{ success: boolean; succeeded: number; failed: number }>;
    };
  },
) {
  return async (ids: string[], status: string) => {
    try {
      const result = await deps.bulkUpdateSessionStatus.mutateAsync({ ids, status });
      if (result.failed > 0) {
        notify.error(
          deps.t('sessions.toast.bulkPartial', {
            succeeded: result.succeeded,
            failed: result.failed,
          }),
        );
      } else {
        notify.success(
          ids.length > 1
            ? deps.t('sessions.bulkStatusSuccessMany', { count: ids.length })
            : deps.t('sessions.bulkStatusSuccess'),
        );
      }
      deps.setSelectedIds([]);
    } catch (error) {
      notify.error(deps.t('sessions.toast.bulkStatusFailed'), {
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
  setSelectedValues((currentValues) => currentValues.includes(nextValue)
    ? currentValues.filter((selectedValue) => selectedValue !== nextValue)
    : [...currentValues, nextValue]);
}
