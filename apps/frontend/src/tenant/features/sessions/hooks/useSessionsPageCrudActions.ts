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
  bulkUpdateSessionStatus: {
    mutateAsync: (payload: { ids: string[]; status: string }) => Promise<{ success: boolean; succeeded: number; failed: number }>;
  };
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
}

export function useSessionsPageCrudActions(params: UseSessionsPageCrudActionsParams) {
  // Sessions setup rights may override the post-start edit lock (with a reason).
  const { canEditSetup } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const handleSave = createSessionSaveHandler({ ...params, canOverrideLock: canEditSetup });
  const handleUpdate = createSessionUpdateHandler({ ...params, canOverrideLock: canEditSetup });
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
