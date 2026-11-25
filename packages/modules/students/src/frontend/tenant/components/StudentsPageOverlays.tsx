import { lazy, Suspense, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import {
  ModuleDrawerLoadingSkeleton,
  ModuleOverlayLoadingFallback,
} from "@mms/fe-core/components/ModuleOverlayLoadingChrome";
import { useSessionsCollection } from "../host/sessionsCollection";
import { useBranding } from "../host/useBranding";
import { StudentsPageConfirmDialogs } from "./StudentsPageConfirmDialogs";
import type { StudentsPageOverlaysProps } from "../hooks/studentsPageOverlaysTypes";
import React from "react";

const StudentForm = lazy(() => import("./StudentForm"));
import { TenantMessageComposerLauncher } from "../host/TenantMessageComposerLauncher";
const StudentDetail = lazy(() =>
  import("./StudentDetail").then((m) => ({
    default: m.default,
  })),
);
const StudentIdCardModal = lazy(() =>
  import("./StudentIdCardModal").then((m) => ({
    default: m.StudentIdCardModal,
  })),
);
import { StudentsCsvImportDialog } from "./StudentsCsvImportDialog";

export const StudentsPageOverlays = function StudentsPageOverlays({
  showStudentForm,
  editStudent,
  onCloseForm,
  onSave,
  viewStudent,
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
  idCardStudents = [],
  onCloseIdCards,
  onPrintIdCard,
  onViewStudent,
  onViewContact,
  importOpen = false,
  onCloseImport,
}: StudentsPageOverlaysProps): React.JSX.Element {
  const sessions = useSessionsCollection();
  const branding = useBranding();

  const idCardItems = useMemo(() => {
    if (idCardStudents.length === 0) return [];
    return idCardStudents.map((student) => {
      const enrolledSet = new Set(student.enrolledSessions ?? []);
      const sessionNames = sessions
        .filter((sess: any) => enrolledSet.has(sess.id))
        .map((sess: any) => sess.name);
      return {
        student,
        sessionNames,
        guardianName: student.fatherName,
        emergencyPhone: student.phone,
      };
    });
  }, [idCardStudents, sessions]);

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<ModuleOverlayLoadingFallback />}>
          <AnimatePresence>
            {showStudentForm ? (
              <StudentForm student={editStudent} onClose={onCloseForm} onSave={onSave} />
            ) : null}
            <TenantMessageComposerLauncher
              messagingTarget={messagingTarget}
              onClose={onCloseComposer}
            />
          </AnimatePresence>
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<ModuleDrawerLoadingSkeleton />}>
          <AnimatePresence>
            {viewStudent ? (
              <StudentDetail
                student={viewStudent}
                canDelete={canDelete}
                onClose={onCloseView}
                onEdit={canWrite ? onEditFromDrawer : undefined}
                onRestore={onRestoreFromDrawer}
                openComposer={openComposer}
                canWriteMessaging={canWriteMessaging}
                onPrintIdCard={onPrintIdCard}
                onViewStudent={onViewStudent}
                onViewContact={onViewContact}
              />
            ) : null}
          </AnimatePresence>
        </Suspense>
      </ErrorBoundary>

      <StudentsPageConfirmDialogs
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

      {idCardStudents.length > 0 && onCloseIdCards ? (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <StudentIdCardModal
              open={idCardStudents.length > 0}
              onClose={onCloseIdCards}
              items={idCardItems}
              // Printed cards must carry the workspace name, not the product name.
              madrasaName={branding.madrasaName}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {importOpen && onCloseImport ? (
        <StudentsCsvImportDialog open={importOpen} onClose={onCloseImport} canWrite={canWrite} />
      ) : null}
    </>
  );
};
