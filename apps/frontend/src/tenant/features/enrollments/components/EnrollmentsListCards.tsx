import React, { useMemo } from "react";
import type { Student } from "@mms/shared";
import { EntityCardsGrid } from "@/components/app/EntityCardsGrid";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { getEnrollmentVisibleWorkColumns } from "@/tenant/features/enrollments/lib/enrollmentListVisibleColumns";
import {
  findEnrollmentStudent,
  getEnrollmentStudentDisplayName,
  type EnrollmentListContentProps,
} from "@/tenant/features/enrollments/lib/enrollmentListContentShared";
import {
  EnrollmentCard,
  type EnrollmentCardProps,
} from "@/tenant/features/enrollments/components/EnrollmentCard";

export { EnrollmentCard, type EnrollmentCardProps };

export type EnrollmentListCardsProps = Omit<
  EnrollmentListContentProps,
  "filteredCount" | "page" | "pageSize" | "getColumnWidth" | "onColumnResize" | "onPageChange"
>;

export function EnrollmentsListCards(props: EnrollmentListCardsProps): React.JSX.Element {
  const {
    enrollments,
    students,
    isColumnVisible,
    columnRegistry,
    canSelectEnrollments,
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    canWrite,
    canDelete,
    showDeleted,
    statusConfig,
    paymentConfig,
    formatCurrency,
    onView,
    onCancel,
    onDelete,
    onRestore,
    onToggleSelectAll,
    onToggleSelectedEnrollment,
    openComposer,
  } = props;
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const pageCountLabel = formatDirectoryPageCountLabel(enrollments.length, t, {
    singular: "enrollments.item.enrollment",
    plural: "enrollments.item.enrollments",
  });

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      map.set(String(s.id), s);
    }
    return map;
  }, [students]);

  const visibleColumns = useMemo(
    () =>
      getEnrollmentVisibleWorkColumns(columnRegistry, isColumnVisible, {
        excludeFace: true,
      }),
    [columnRegistry, isColumnVisible],
  );

  return (
    <EntityCardsGrid
      items={enrollments}
      selectedIds={selectedIds}
      onSelectAll={canSelectEnrollments ? () => onToggleSelectAll(!allVisibleSelected) : undefined}
      allSelected={allVisibleSelected}
      someSelected={someVisibleSelected}
      selectAllLabel={t("enrollments.table.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("enrollments.selectedCount", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="enrollments-cards"
      renderItem={(enrollment) => {
        const student = findEnrollmentStudent(enrollment, studentsById);
        const studentDisplayName = getEnrollmentStudentDisplayName(enrollment, studentsById);

        return (
          <EnrollmentCard
            key={enrollment.id}
            enrollment={enrollment}
            student={student}
            studentDisplayName={studentDisplayName}
            selectedIds={selectedIds}
            canSelectEnrollments={canSelectEnrollments}
            canWrite={canWrite}
            canDelete={canDelete}
            showDeleted={showDeleted}
            reducedMotion={reducedMotion}
            visibleColumns={visibleColumns}
            students={students}
            statusConfig={statusConfig}
            paymentConfig={paymentConfig}
            formatCurrency={formatCurrency}
            onView={onView}
            onCancel={onCancel}
            onDelete={onDelete}
            onRestore={onRestore}
            onToggleSelectedEnrollment={onToggleSelectedEnrollment}
            openComposer={openComposer}
          />
        );
      }}
    />
  );
}
