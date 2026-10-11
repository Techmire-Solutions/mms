import { lazy, Suspense, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import {
  ModuleDrawerLoadingSkeleton,
  ModuleOverlayLoadingFallback,
} from "@/components/ui/ModuleOverlayLoadingChrome";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { StudentsPageConfirmDialogs } from "@/tenant/features/students/components/StudentsPageConfirmDialogs";
import type { StudentsPageOverlaysProps } from "@/tenant/features/students/hooks/studentsPageOverlaysTypes";
import React from "react";

const StudentForm = lazy(() => import("@/tenant/features/students/components/StudentForm"));
const MessageComposer = lazy(() => import("@/tenant/components/messaging/TenantMessageComposer"));
const StudentDetail = lazy(() =>
  import("@/tenant/features/students/components/StudentDetail").then((m) => ({
    default: m.default,
  })),
);
const StudentIdCardModal = lazy(() =>
  import("@/tenant/features/students/components/StudentIdCardModal").then((m) => ({
    default: m.StudentIdCardModal,
  })),
);
import { StudentsCsvImportDialog } from "@/tenant/features/students/components/StudentsCsvImportDialog";

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

  const idCardItems = useMemo(() => {
    if (idCardStudents.length === 0) return [];
    return idCardStudents.map((student) => {
      const enrolledSet = new Set(student.enrolledSessions ?? []);
      const sessionNames = sessions
        .filter((sess) => enrolledSet.has(sess.id))
        .map((sess) => sess.name);
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
            {messagingTarget ? (
              <MessageComposer
                channel={messagingTarget.channel}
                recipients={messagingTarget.recipients}
                onClose={onCloseComposer}
              />
            ) : null}
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
