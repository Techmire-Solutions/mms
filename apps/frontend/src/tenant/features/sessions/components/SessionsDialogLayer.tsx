import React, { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import type { Session } from "@/lib/data/sessionsData";
import { SessionsListConfirmDialogs } from "@/tenant/features/sessions/components/SessionsListConfirmDialogs";
import { useSessionDetail } from "@/tenant/features/sessions/hooks/useSessions";

const SessionDetail = lazy(() =>
  import("@/tenant/features/sessions/components/SessionDetail").then((m) => ({
    default: m.SessionDetail,
  }))
);
const SessionForm = lazy(() =>
  import("@/tenant/features/sessions/components/SessionForm").then((m) => ({
    default: m.SessionForm,
  }))
);
import { SessionsCsvImportDialog } from "@/tenant/features/sessions/components/SessionsCsvImportDialog";
import { SessionLockOverrideDialog } from "@/tenant/features/sessions/components/SessionLockOverrideDialog";

interface SessionsDialogLayerProps {
  showForm: boolean;
  editSession: Session | null;
  detailSession: Session | null;
  canDelete: boolean;
  canWrite?: boolean;
  importOpen?: boolean;
  onCloseImport?: () => void;
  pendingDeleteId: string | null;
  confirmBulkDeleteOpen: boolean;
  confirmBulkRestoreOpen: boolean;
  selectedCount: number;
  onCloseForm: () => void;
  onSave: (session: Session) => Promise<void>;
  onCloseDetail: () => void;
  onUpdate: (session: Session) => Promise<void>;
  onEdit: (session: Session) => void;
  onRestore: (sessionId: string) => void | Promise<void>;
  onPendingDeleteChange: (id: string | null) => void;
  onConfirmDelete: (reason?: string) => void;
  onBulkDeleteOpenChange: (open: boolean) => void;
  onConfirmBulkDelete: (reason?: string) => void;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkRestore: () => void;
}

export function SessionsDialogLayer({
  showForm,
  editSession,
  detailSession,
  canDelete,
  pendingDeleteId,
  confirmBulkDeleteOpen,
  confirmBulkRestoreOpen,
  selectedCount,
  importOpen = false,
  onCloseImport,
  canWrite = false,
  onCloseForm,
  onSave,
  onCloseDetail,
  onUpdate,
  onEdit,
  onRestore,
  onPendingDeleteChange,
  onConfirmDelete,
  onBulkDeleteOpenChange,
  onConfirmBulkDelete,
  onBulkRestoreOpenChange,
  onConfirmBulkRestore,
}: SessionsDialogLayerProps): React.JSX.Element {
  // List rows are summary-shaped; detail and edit must only render once the full session is loaded.
  const fullDetailSession = useSessionDetail(detailSession);
  const fullEditSession = useSessionDetail(editSession);
  const formReady = !editSession || fullEditSession !== null;
  return (
    <>
      <AnimatePresence>
        {showForm && formReady && (
          <Suspense fallback={null}>
            <SessionForm
              open={showForm}
              session={fullEditSession}
              onClose={onCloseForm}
              onSave={onSave}
            />
          </Suspense>
        )}
        {fullDetailSession ? (
          <Suspense fallback={null}>
            <SessionDetail
              session={fullDetailSession}
              onClose={onCloseDetail}
              onUpdate={onUpdate}
              onEdit={onEdit}
              canDelete={canDelete}
              onRestore={onRestore}
            />
          </Suspense>
        ) : null}
      </AnimatePresence>

      <SessionLockOverrideDialog />

      <SessionsListConfirmDialogs
        selectedCount={selectedCount}
        confirmBulkDeleteOpen={confirmBulkDeleteOpen}
        confirmBulkRestoreOpen={confirmBulkRestoreOpen}
        pendingDeleteId={pendingDeleteId}
        onBulkDeleteOpenChange={onBulkDeleteOpenChange}
        onBulkRestoreOpenChange={onBulkRestoreOpenChange}
        onPendingDeleteChange={onPendingDeleteChange}
        onConfirmBulkDelete={onConfirmBulkDelete}
        onConfirmBulkRestore={onConfirmBulkRestore}
        onConfirmDelete={onConfirmDelete}
      />

      {importOpen && onCloseImport ? (
        <SessionsCsvImportDialog
          open={importOpen}
          onClose={onCloseImport}
          canWrite={canWrite}
        />
      ) : null}
    </>
  );
}
