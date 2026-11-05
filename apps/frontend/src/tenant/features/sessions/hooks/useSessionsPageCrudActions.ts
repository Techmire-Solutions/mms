import type { Dispatch, SetStateAction } from "react";
import type { Session } from "@/lib/data/sessionsData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { SESSIONS_MODULE_MANIFEST } from "@mms/shared";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  createSessionBulkDeleteHandler,
  createSessionBulkRestoreHandler,
  createSessionBulkStatusHandler,
  createSessionDeleteHandler,
  createSessionRestoreHandler,
  createSessionSaveHandler,
  createSessionUpdateHandler,
} from "./sessionsPageControllerActions";

export interface UseSessionsPageCrudActionsParams {
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
  bulkUpdateSessionStatus: {
    mutateAsync: (payload: {
      ids: string[];
      status: string;
    }) => Promise<{ succeeded: number; failed: number }>;
  };
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}

export function useSessionsPageCrudActions(params: UseSessionsPageCrudActionsParams) {
  // Overriding the post-start edit lock needs `sessions.override_lock` plus a reason (audited).
  const { canOverrideLock } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const handleSave = createSessionSaveHandler({ ...params, canOverrideLock });
  const handleUpdate = createSessionUpdateHandler({ ...params, canOverrideLock });
  const handleDelete = createSessionDeleteHandler(params);
  const handleRestore = createSessionRestoreHandler(params);
  const handleBulkDelete = createSessionBulkDeleteHandler(params);
  const handleBulkRestore = createSessionBulkRestoreHandler(params);
  const handleBulkStatusChange = createSessionBulkStatusHandler({
    t: params.t,
    bulkUpdateSessionStatus: params.bulkUpdateSessionStatus,
    setSelectedIds: params.setSelectedIds,
  });

  return {
    handleSave,
    handleUpdate,
    handleDelete,
    handleRestore,
    handleBulkDelete,
    handleBulkRestore,
    handleBulkStatusChange,
  };
}
