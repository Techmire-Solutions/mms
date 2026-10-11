import { useState } from "react";
import { GraduationCap, BookOpen, IdCard } from "lucide-react";
import { STUDENTS_MODULE_MANIFEST, type Student, type StudentsBulkEnrollBody } from "@mms/shared";
import { ModuleUniversalBulkActionBar } from "@/components/ui/ModuleUniversalBulkActionBar";
import { Button } from "@/components/ui/button";
import { type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { StudentsBulkEnrollModal } from "@/tenant/features/students/components/StudentsBulkEnrollModal";
import type { StudentsSelectionTargets } from "@/tenant/features/students/hooks/studentsSelectionTargets";

export interface StudentsBulkActionBarProps {
  selectedCount: number;
  viewingDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canWriteMessaging?: boolean;
  canExport?: boolean;
  bulkActions?: readonly string[];
  selectedTargets: StudentsSelectionTargets;
  studentStatusOptions: readonly string[];
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  onWhatsApp: (targets: Student[]) => void;
  onSms: (targets: Student[]) => void;
  onEmail: (targets: Student[]) => void;
  onBulkStatusChange?: (status: string) => void;
  onBulkEnroll?: (payload: {
    sessionIds: string[];
    mode: StudentsBulkEnrollBody["mode"];
  }) => Promise<void> | void;
  isBulkEnrollPending?: boolean;
  onBulkPrintIdCards?: () => void;
  onBulkExport?: () => void;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onClearSelection: () => void;
  /** Disables the bulk status action while the status mutation is pending. */
  statusPending?: boolean;
}

/** Students Work bulk bar — delegates core actions to ModuleUniversalBulkActionBar. */
export function StudentsBulkActionBar({
  selectedCount,
  viewingDeleted,
  canWrite,
  canDelete,
  canWriteMessaging = false,
  canExport = false,
  bulkActions = STUDENTS_MODULE_MANIFEST.work.bulkActions,
  selectedTargets,
  studentStatusOptions: _studentStatusOptions,
  statusBadgeConfig,
  onWhatsApp,
  onSms,
  onEmail,
  onBulkStatusChange,
  onBulkEnroll,
  isBulkEnrollPending = false,
  onBulkPrintIdCards,
  onBulkExport,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onClearSelection,
  statusPending = false,
}: StudentsBulkActionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  return (
    <>
      <ModuleUniversalBulkActionBar<Student>
        selectedCount={selectedCount}
        viewingDeleted={viewingDeleted}
        canWrite={canWrite}
        canDelete={canDelete}
        canExport={canExport}
        canWriteMessaging={canWriteMessaging}
        leadingIcon={GraduationCap}
        i18nNamespace="students"
        bulkActions={bulkActions}
        onClearSelection={onClearSelection}
        onRequestBulkDelete={onRequestBulkDelete}
        onRequestBulkRestore={onRequestBulkRestore}
        onBulkExport={onBulkExport}
        statusConfig={statusBadgeConfig}
        onBulkStatusChange={onBulkStatusChange}
        statusPending={statusPending}
        messagingTargets={selectedTargets}
        onWhatsApp={onWhatsApp}
        onSms={onSms}
        onEmail={onEmail}
        extraActions={
          !viewingDeleted && (onBulkEnroll || onBulkPrintIdCards) ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {canWrite && onBulkEnroll && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEnrollModalOpen(true)}
                  disabled={isBulkEnrollPending}
                  className="min-h-11 gap-1.5 px-3 font-medium text-xs border-border/60 hover:bg-muted/80"
                >
                  <BookOpen className="w-3.5 h-3.5" aria-hidden />
                  <span>{t("students.bulkEnroll")}</span>
                </Button>
              )}
              {onBulkPrintIdCards && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBulkPrintIdCards}
                  className="min-h-11 gap-1.5 px-3 font-medium text-xs border-border/60 hover:bg-muted/80"
                >
                  <IdCard className="w-3.5 h-3.5" aria-hidden />
                  <span>{t("students.bulkPrintIdCards")}</span>
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {enrollModalOpen && onBulkEnroll && (
        <StudentsBulkEnrollModal
          open={enrollModalOpen}
          onClose={() => setEnrollModalOpen(false)}
          selectedCount={selectedCount}
          onConfirm={onBulkEnroll}
          isPending={isBulkEnrollPending}
        />
      )}
    </>
  );
}
