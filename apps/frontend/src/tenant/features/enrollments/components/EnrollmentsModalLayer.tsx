import type React from "react";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { FormModal } from "@/components/ui/FormModal";
import { EnrollmentDetail } from "@/tenant/features/enrollments/components/EnrollmentDetail";
import { EnrollmentsListConfirmDialogs } from "@/tenant/features/enrollments/components/EnrollmentsListConfirmDialogs";
import { EnrollmentWizard } from "@/tenant/features/enrollments/components/EnrollmentWizard";
import type { Enrollment } from "@/lib/data/enrollmentData";

export interface EnrollmentsModalLayerProps {
  viewing: Enrollment | null;
  canWrite: boolean;
  showDeleted: boolean;
  showWizard: boolean;
  pendingDeleteId: string | null;
  wizardTitle: string;
  onCloseViewing: () => void;
  onStatusChange: (id: string, newStatus: Enrollment["status"]) => void;
  onPaymentStatusChange: (id: string, newStatus: Enrollment["paymentStatus"]) => void;
  onCloseWizard: () => void;
  onCompleteWizard: (enrollment: Enrollment) => Promise<void>;
  onPendingDeleteChange: (id: string | null) => void;
  onConfirmDelete: (reason?: string) => void;
  bulkDeleteCount: number;
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  bulkRestoreOpen: boolean;
  onBulkRestoreOpenChange: (open: boolean) => void;
  onConfirmBulkDelete: (reason?: string) => void;
  onConfirmBulkRestore: () => void;
  canDelete?: boolean;
  onRestore?: (id: string) => void;
}

export function EnrollmentsModalLayer({
  viewing,
  canWrite,
  showDeleted,
  showWizard,
  pendingDeleteId,
  wizardTitle,
  onCloseViewing,
  onStatusChange,
  onPaymentStatusChange,
  onCloseWizard,
  onCompleteWizard,
  onPendingDeleteChange,
  onConfirmDelete,
  bulkDeleteCount,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  bulkRestoreOpen,
  onBulkRestoreOpenChange,
  onConfirmBulkDelete,
  onConfirmBulkRestore,
  canDelete,
  onRestore,
}: EnrollmentsModalLayerProps): React.JSX.Element {
  return (
    <>
      <AnimatePresence>
        {viewing && (
          <ErrorBoundary>
            <EnrollmentDetail
              enrollment={viewing}
              canWrite={canWrite && !showDeleted}
              canDelete={canDelete}
              onRestore={onRestore}
              onClose={onCloseViewing}
              onStatusChange={onStatusChange}
              onPaymentStatusChange={onPaymentStatusChange}
            />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      <FormModal
        open={showWizard}
        onClose={onCloseWizard}
        title={wizardTitle}
        size="xl"
        hideFooter
        panelClassName="h-modal-tall max-h-modal-tall"
      >
        <ErrorBoundary>
          <EnrollmentWizard onComplete={onCompleteWizard} onCancel={onCloseWizard} />
        </ErrorBoundary>
      </FormModal>

      <EnrollmentsListConfirmDialogs
        pendingDeleteId={pendingDeleteId}
        onPendingDeleteChange={onPendingDeleteChange}
        onConfirmDelete={onConfirmDelete}
        bulkDeleteCount={bulkDeleteCount}
        bulkDeleteOpen={bulkDeleteOpen}
        onBulkDeleteOpenChange={onBulkDeleteOpenChange}
        bulkRestoreOpen={bulkRestoreOpen}
        onBulkRestoreOpenChange={onBulkRestoreOpenChange}
        onConfirmBulkDelete={onConfirmBulkDelete}
        onConfirmBulkRestore={onConfirmBulkRestore}
      />
    </>
  );
}
