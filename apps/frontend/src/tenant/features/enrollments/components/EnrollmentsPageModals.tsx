import React from "react";
import { EnrollmentsModalLayer } from "./EnrollmentsModalLayer";
import { EnrollmentsCsvImportDialog } from "./EnrollmentsCsvImportDialog";
import type { useEnrollmentsPageState } from "../hooks/useEnrollmentsPageState";

interface EnrollmentsPageModalsProps {
  pageState: ReturnType<typeof useEnrollmentsPageState>;
  importOpen?: boolean;
  onCloseImport?: () => void;
}

export function EnrollmentsPageModals({
  pageState,
  importOpen = false,
  onCloseImport,
}: EnrollmentsPageModalsProps) {
  const {
    t,
    canWriteEnrollments,
    canDelete,
    directoryFilters,
    viewing,
    setViewing,
    showWizard,
    setShowWizard,
    pendingDeleteId,
    setPendingDeleteId,
    confirmBulkDeleteOpen,
    setConfirmBulkDeleteOpen,
    confirmBulkRestoreOpen,
    setConfirmBulkRestoreOpen,
    selection,
    pageActions,
  } = pageState;

  const { showDeleted } = directoryFilters;
  const { selectedIds, clearSelection } = selection;
  const {
    handleComplete,
    handleDelete,
    handleRestore,
    handleStatusChange,
    handlePaymentStatusChange,
    handleBulkDelete,
    handleBulkRestore,
  } = pageActions;

  return (
    <>
      <EnrollmentsModalLayer
        viewing={viewing}
        canWrite={canWriteEnrollments}
        canDelete={canDelete}
        onRestore={handleRestore}
        showDeleted={showDeleted}
        showWizard={showWizard}
        pendingDeleteId={pendingDeleteId}
        wizardTitle={t("enrollments.new")}
        onCloseViewing={() => setViewing(null)}
        onStatusChange={handleStatusChange}
        onPaymentStatusChange={handlePaymentStatusChange}
        onCloseWizard={() => setShowWizard(false)}
        onCompleteWizard={handleComplete}
        onPendingDeleteChange={setPendingDeleteId}
        onConfirmDelete={(deletionReason) => {
          if (pendingDeleteId) handleDelete(pendingDeleteId, deletionReason);
          setPendingDeleteId(null);
        }}
        bulkDeleteCount={selectedIds.length}
        bulkDeleteOpen={confirmBulkDeleteOpen}
        onBulkDeleteOpenChange={setConfirmBulkDeleteOpen}
        bulkRestoreOpen={confirmBulkRestoreOpen}
        onBulkRestoreOpenChange={setConfirmBulkRestoreOpen}
        onConfirmBulkDelete={(deletionReason) => {
          handleBulkDelete(selectedIds, deletionReason);
          setConfirmBulkDeleteOpen(false);
          clearSelection();
        }}
        onConfirmBulkRestore={() => {
          handleBulkRestore(selectedIds);
          setConfirmBulkRestoreOpen(false);
          clearSelection();
        }}
      />

      {importOpen && onCloseImport ? (
        <EnrollmentsCsvImportDialog
          open={importOpen}
          onClose={onCloseImport}
          canWrite={canWriteEnrollments}
        />
      ) : null}
    </>
  );
}
