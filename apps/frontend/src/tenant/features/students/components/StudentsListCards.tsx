import type React from "react";
import { formatDirectoryPageCountLabel } from "@/lib/formatDirectoryPageCountLabel";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTranslation } from "@/hooks/useTranslation";
import { EntityCardsGrid } from "@/components/ui/EntityCardsGrid";
import { useStudentEntityDescriptor } from "@/tenant/features/students/hooks/useStudentEntityDescriptor";
import type { StudentsListCardsProps } from "@/tenant/features/students/components/studentsListTypes";

export type { StudentsListCardsProps };

import { StudentCard } from "@/tenant/features/students/components/StudentCard";
export type { StudentCardComponentProps } from "@/tenant/features/students/components/StudentCard";

export function StudentsListCards({
  paginatedStudents,
  sessions: _sessions,
  selectedIds,
  allSelected,
  someSelected,
  viewingDeleted,
  canWrite,
  canDelete,
  canWriteMessaging = false,
  statusBadgeConfig,
  isColumnVisible,
  columnRegistry,
  onSelectAll,
  onSelectOne,
  onViewStudent,
  onEdit,
  onDelete,
  onRestore,
  onOpenComposer,
}: StudentsListCardsProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const descriptor = useStudentEntityDescriptor();
  const pageCountLabel = formatDirectoryPageCountLabel(paginatedStudents.length, t, {
    singular: "students.form.student",
    plural: "students.table.students",
  });

  return (
    <EntityCardsGrid
      items={paginatedStudents}
      selectedIds={selectedIds}
      onSelectAll={onSelectAll}
      allSelected={allSelected}
      someSelected={someSelected}
      selectAllLabel={t("students.table.selectAll")}
      deselectAllLabel={t("common.deselect")}
      selectedCountLabel={t("students.selectedCount", { count: selectedIds.length })}
      pageCountLabel={pageCountLabel}
      checkboxIdPrefix="students"
      renderItem={(studentCard) => (
        <StudentCard
          key={studentCard.id}
          student={studentCard}
          selectedIds={selectedIds}
          viewingDeleted={viewingDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          canWriteMessaging={canWriteMessaging}
          statusBadgeConfig={statusBadgeConfig}
          isColumnVisible={isColumnVisible}
          columnRegistry={columnRegistry}
          descriptor={descriptor}
          reducedMotion={reducedMotion}
          onSelectOne={onSelectOne}
          onViewStudent={onViewStudent}
          onEdit={onEdit}
          onDelete={onDelete}
          onRestore={onRestore}
          onOpenComposer={onOpenComposer}
        />
      )}
    />
  );
}
