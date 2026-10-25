import React from "react";
import type { ModuleColumnRegistryEntry, Student } from "@mms/shared";
import { DirectoryEntityCard } from "@/components/app/DirectoryEntityCard";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/app/entityCardChrome";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import type { Enrollment } from "@/lib/data/enrollmentData";
import { EnrollmentRowActions } from "@/tenant/features/enrollments/components/EnrollmentRowActions";
import { renderEnrollmentWorkColumnValue } from "@/tenant/features/enrollments/components/enrollmentWorkColumnCell";
import type { EnrollmentListContentProps } from "@/tenant/features/enrollments/lib/enrollmentListContentShared";

export interface EnrollmentCardProps {
  enrollment: Enrollment;
  student?: Student;
  studentDisplayName: string;
  selectedIds: string[];
  canSelectEnrollments: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  showDeleted?: boolean;
  reducedMotion: boolean;
  visibleColumns: ModuleColumnRegistryEntry[];
  students: Student[];
  statusConfig: Record<string, StatusBadgeConfigItem>;
  paymentConfig: Record<string, StatusBadgeConfigItem>;
  formatCurrency: (value: number) => string;
  onView: (enrollment: Enrollment) => void;
  onCancel: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleSelectedEnrollment: (id: string, checked: boolean) => void;
  openComposer: EnrollmentListContentProps["openComposer"];
}

/** Work directory card — DirectoryEntityCard SSOT (do not hand-compose EntityCard). */
export function EnrollmentCard({
  enrollment,
  student,
  studentDisplayName,
  selectedIds,
  canSelectEnrollments,
  canWrite = false,
  canDelete = false,
  showDeleted = false,
  reducedMotion,
  visibleColumns,
  students,
  statusConfig,
  paymentConfig,
  formatCurrency,
  onView,
  onCancel,
  onDelete,
  onRestore,
  onToggleSelectedEnrollment,
  openComposer,
}: EnrollmentCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const name = studentDisplayName || enrollment.studentName;

  return (
    <DirectoryEntityCard
      entity={enrollment}
      selectedIds={selectedIds}
      canSelect={canSelectEnrollments}
      onToggleSelected={onToggleSelectedEnrollment}
      onView={onView}
      reducedMotion={reducedMotion}
      header={{
        displayName: name,
        subtitle: student?.grNumber ? (
          <p className="text-xs font-bold text-primary">
            {t("enrollments.detail.grNumber")}: {student.grNumber}
          </p>
        ) : undefined,
      }}
      viewLabel={t("enrollments.actions.viewShort")}
      viewAriaLabel={`${t("enrollments.table.viewProfile")} - ${name}`}
      columns={visibleColumns}
      keyFor={(col) => col.key}
      labelFor={(col) => col.label}
      renderValue={(col) =>
        renderEnrollmentWorkColumnValue(enrollment, col.key, {
          t,
          students,
          statusConfig,
          paymentConfig,
          formatCurrency,
          emptyFallback: null,
        })
      }
      overflowActions={
        <EnrollmentRowActions
          enrollment={enrollment}
          student={student}
          canWrite={canWrite}
          canDelete={canDelete}
          showDeleted={showDeleted}
          hideViewItem
          triggerClassName={ENTITY_CARD_OVERFLOW_TRIGGER_CLASS}
          onView={onView}
          onCancel={onCancel}
          onDelete={onDelete}
          onRestore={onRestore}
          openComposer={openComposer}
        />
      }
    />
  );
}
