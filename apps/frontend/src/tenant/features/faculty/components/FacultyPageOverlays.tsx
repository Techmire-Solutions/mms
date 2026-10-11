import { getFacultyAssignedClasses } from "@/lib/faculty/facultyAssignment";

import { lazy, Suspense, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ModuleDrawerLoadingSkeleton,
  ModuleOverlayLoadingFallback,
} from "@/components/ui/ModuleOverlayLoadingChrome";
import { useSessions } from "@/tenant/hooks/collections/sessions";
import { useBranding } from "@/tenant/hooks/useBranding";
import { FacultyPageConfirmDialogs } from "@/tenant/features/faculty/components/FacultyPageConfirmDialogs";
import { FacultyCatalogCreateOverlays } from "@/tenant/features/faculty/components/FacultyCatalogCreateOverlays";
import { FacultyCsvImportDialog } from "@/tenant/features/faculty/components/FacultyCsvImportDialog";
import type { FacultyPageOverlaysProps } from "@/tenant/features/faculty/hooks/facultyPageOverlaysTypes";
import React from "react";

const FacultyForm = lazy(() =>
  import("@/tenant/features/faculty/components/FacultyForm").then((m) => ({
    default: m.FacultyForm,
  })),
);
const MessageComposer = lazy(() => import("@/tenant/components/messaging/TenantMessageComposer"));
const FacultyDetail = lazy(() =>
  import("@/tenant/features/faculty/components/FacultyDetail").then((m) => ({
    default: m.FacultyDetail,
  })),
);
const FacultyIdCardModal = lazy(() =>
  import("@/tenant/features/faculty/components/FacultyIdCardModal").then((m) => ({
    default: m.FacultyIdCardModal,
  })),
);

export const FacultyPageOverlays = function FacultyPageOverlays({
  showForm,
  editFaculty,
  onCloseForm,
  onSave,
  viewFaculty,
  onCloseView,
  onEditFromDrawer,
  onRestoreFromDrawer,
  messagingTarget,
  onCloseComposer,
  openComposer,
  canWriteMessaging,
  canWrite,
  canDelete,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  selectedCount,
  onConfirmBulkDelete,
  deleteTarget,
  onDeleteTargetOpenChange,
  onConfirmSingleDelete,
  bulkRestoreOpen,
  onBulkRestoreOpenChange,
  onConfirmBulkRestore,
  idCardFaculty = [],
  onCloseIdCards,
  onPrintIdCard,
  createDepartmentOpen = false,
  onCloseCreateDepartment,
  createDesignationOpen = false,
  onCloseCreateDesignation,
  importEntity = null,
  onCloseImport,
}: FacultyPageOverlaysProps): React.JSX.Element {
  const configPending = false;
  const branding = useBranding();
  const sessionsQuery = useSessions();
  const sessions = sessionsQuery.data ?? [];
  const effectiveEdit = editFaculty;
  const effectiveView = viewFaculty;
  const effectiveIdCards = idCardFaculty;

  const idCardItems = useMemo(() => {
    return effectiveIdCards.map((facultyMember) => {
      const assignedClasses = facultyMember.id
        ? getFacultyAssignedClasses(facultyMember.id, sessions)
        : [];

      return {
        faculty: facultyMember,
        assignedClasses: assignedClasses.map((cls) => `${cls.className} (${cls.sessionName})`),
        qualification: facultyMember.qualification,
        emergencyPhone: facultyMember.phone ? String(facultyMember.phone) : undefined,
      };
    });
  }, [effectiveIdCards, sessions]);

  return (
    <>
      <Suspense fallback={<ModuleOverlayLoadingFallback />}>
        <AnimatePresence>
          {showForm && canWrite && !configPending ? (
            <FacultyForm
              faculty={effectiveEdit ?? undefined}
              onClose={onCloseForm}
              onSave={onSave}
            />
          ) : null}
          {messagingTarget ? (
            <MessageComposer
              channel={messagingTarget.channel}
              recipients={messagingTarget.recipients}
              onClose={onCloseComposer}
            />
          ) : null}
        </AnimatePresence>
      </Suspense>

      <Suspense fallback={<ModuleDrawerLoadingSkeleton />}>
        <AnimatePresence>
          {effectiveView && !configPending ? (
            <FacultyDetail
              faculty={effectiveView}
              canDelete={canDelete}
              onClose={onCloseView}
              onEdit={canWrite ? onEditFromDrawer : undefined}
              onRestore={onRestoreFromDrawer}
              onPrintIdCard={onPrintIdCard}
              openComposer={openComposer}
              canWriteMessaging={canWriteMessaging}
            />
          ) : null}
        </AnimatePresence>
      </Suspense>

      {effectiveIdCards.length > 0 && onCloseIdCards ? (
        <Suspense fallback={null}>
          <FacultyIdCardModal
            open={effectiveIdCards.length > 0}
            onClose={onCloseIdCards}
            items={idCardItems}
            madrasaName={branding.madrasaName || undefined}
          />
        </Suspense>
      ) : null}

      <FacultyPageConfirmDialogs
        bulkDeleteOpen={bulkDeleteOpen}
        onBulkDeleteOpenChange={onBulkDeleteOpenChange}
        selectedCount={selectedCount}
        onConfirmBulkDelete={onConfirmBulkDelete}
        deleteTarget={deleteTarget}
        onDeleteTargetOpenChange={onDeleteTargetOpenChange}
        onConfirmSingleDelete={onConfirmSingleDelete}
        bulkRestoreOpen={bulkRestoreOpen}
        onBulkRestoreOpenChange={onBulkRestoreOpenChange}
        onConfirmBulkRestore={onConfirmBulkRestore}
      />

      {onCloseCreateDepartment && onCloseCreateDesignation ? (
        <FacultyCatalogCreateOverlays
          createDepartmentOpen={createDepartmentOpen}
          onCloseDepartment={onCloseCreateDepartment}
          createDesignationOpen={createDesignationOpen}
          onCloseDesignation={onCloseCreateDesignation}
        />
      ) : null}

      {onCloseImport ? (
        <FacultyCsvImportDialog
          open={Boolean(importEntity)}
          entity={importEntity}
          onClose={onCloseImport}
          canWrite={canWrite}
        />
      ) : null}
    </>
  );
};

export type { FacultyPageOverlaysProps };
