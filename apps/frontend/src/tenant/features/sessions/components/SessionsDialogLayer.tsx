import React, { Suspense, lazy } from "react";
import { AnimatePresence } from "framer-motion";
import type { Session } from "@/lib/data/sessionsData";
import { SessionsListConfirmDialogs } from "@/tenant/features/sessions/components/SessionsListConfirmDialogs";
import { useSessionDetailState } from "@/tenant/features/sessions/hooks/useSessions";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { ErrorState } from "@/components/app/ErrorState";
import { Modal } from "@/components/app/Modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";

const SessionDetail = lazy(() =>
  import("@/tenant/features/sessions/components/SessionDetail").then((m) => ({
    default: m.SessionDetail,
  })),
);
const SessionForm = lazy(() =>
  import("@/tenant/features/sessions/components/SessionForm").then((m) => ({
    default: m.SessionForm,
  })),
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

/** Busy surface shown while a summary is being resolved into the full session record. */
function SessionEditingSkeleton({
  title,
  onClose,
  isError,
  onRetry,
}: {
  title: string;
  onClose: () => void;
  isError: boolean;
  onRetry: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Modal open onClose={onClose} title={title} size="lg" hideFooter>
      {isError ? (
        <ErrorState
          title={t("sessions.loadFailed")}
          description={t("sessions.loadFailedHint")}
          onRetry={onRetry}
        />
      ) : (
        <div className="space-y-3" aria-busy="true" role="status" aria-live="polite">
          <span className="sr-only">{t("common.loading")}</span>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </Modal>
  );
}

function SessionDetailSkeleton({
  summary,
  onClose,
  isError,
  onRetry,
}: {
  summary: Session;
  onClose: () => void;
  isError: boolean;
  onRetry: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <DetailDrawerShell
      onClose={onClose}
      title={summary.name}
      ariaLabel={t("sessions.detail.ariaLabel")}
      size="2xl"
    >
      {isError ? (
        <ErrorState
          title={t("sessions.loadFailed")}
          description={t("sessions.loadFailedHint")}
          onRetry={onRetry}
        />
      ) : (
        <div className="space-y-3 p-1" aria-busy="true" role="status" aria-live="polite">
          <span className="sr-only">{t("common.loading")}</span>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      )}
    </DetailDrawerShell>
  );
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
  const { t } = useTranslation();
  // List rows are summary-shaped; detail and edit must only render the full record. Loading/error
  // states stay visible so a slow fetch never looks like a dead click.
  const detailState = useSessionDetailState(detailSession);
  const editState = useSessionDetailState(editSession);
  const fullDetailSession = detailState.session;
  const fullEditSession = editState.session;
  const isCreating = showForm && !editSession;
  const isEditing = showForm && Boolean(editSession);
  const editResolved = Boolean(fullEditSession);

  return (
    <>
      <AnimatePresence>
        {isEditing && !editResolved ? (
          <SessionEditingSkeleton
            title={t("sessions.form.editTitle")}
            onClose={onCloseForm}
            isError={editState.isError}
            onRetry={editState.refetch}
          />
        ) : null}
        {isCreating || (isEditing && editResolved) ? (
          <Suspense
            fallback={
              <SessionEditingSkeleton
                title={isCreating ? t("sessions.form.addTitle") : t("sessions.form.editTitle")}
                onClose={onCloseForm}
                isError={false}
                onRetry={() => undefined}
              />
            }
          >
            <SessionForm
              open={showForm}
              session={fullEditSession}
              onClose={onCloseForm}
              onSave={onSave}
            />
          </Suspense>
        ) : null}
        {detailSession && !fullDetailSession ? (
          <SessionDetailSkeleton
            summary={detailSession}
            onClose={onCloseDetail}
            isError={detailState.isError}
            onRetry={detailState.refetch}
          />
        ) : null}
        {fullDetailSession ? (
          <Suspense
            fallback={
              <SessionDetailSkeleton
                summary={fullDetailSession}
                onClose={onCloseDetail}
                isError={false}
                onRetry={() => undefined}
              />
            }
          >
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
        <SessionsCsvImportDialog open={importOpen} onClose={onCloseImport} canWrite={canWrite} />
      ) : null}
    </>
  );
}
