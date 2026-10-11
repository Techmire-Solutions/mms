import { GraduationCap } from "lucide-react";
import type { Student, StudentsListPageResult } from "@mms/shared";
import { ModuleWorkDirectoryEmpty } from "@/components/ui/ModuleWorkDirectoryEmpty";
import { ModuleWorkListStateShell } from "@/components/ui/ModuleWorkListStateShell";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useTranslation } from "@/hooks/useTranslation";
import StudentsListContent from "@/tenant/features/students/components/StudentsListContent";
import type { StudentsListContentProps } from "@/tenant/features/students/components/StudentsListContent";
import type { useStudentColumnLayout } from "@/tenant/features/students/hooks/useStudentColumnLayout";

export interface StudentsListProps extends Omit<
  StudentsListContentProps,
  | "students"
  | "viewMode"
  | "isColumnVisible"
  | "columnRegistry"
  | "getColumnWidth"
  | "onColumnResize"
  | "hasActiveFilters"
  | "onClearFilters"
  | "onShowActive"
> {
  isWorkPageLoading: boolean;
  isWorkPageError: boolean;
  isWorkPageFetching: boolean;
  onRetry: () => void;
  workStudents: Student[];
  workPageData: StudentsListPageResult | undefined;
  useServerWork: boolean;
  viewMode: WorkDirectoryViewMode;
  columnLayout: ReturnType<typeof useStudentColumnLayout>;
  onPageChange: (page: number) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onShowActive: () => void;
}

/** Loading / error / empty / directory / pagination — Contacts WorkListBody analogue. */
export function StudentsList({
  isWorkPageLoading,
  isWorkPageError,
  isWorkPageFetching,
  onRetry,
  workStudents,
  workPageData,
  useServerWork,
  viewMode,
  columnLayout,
  onPageChange,
  hasActiveFilters,
  onClearFilters,
  onShowActive,
  viewingDeleted = false,
  canWrite = true,
  ...listProps
}: StudentsListProps): React.JSX.Element {
  const { t } = useTranslation();

  const emptyDescription = hasActiveFilters
    ? t("students.tryAdjustingFilters")
    : viewingDeleted
      ? t("students.emptyTrashHint")
      : canWrite
        ? t("students.clickAddStudent")
        : t("students.emptyDirectoryReadOnly");

  return (
    <ModuleWorkListStateShell
      isError={isWorkPageError}
      isLoading={isWorkPageLoading}
      isFetching={isWorkPageFetching}
      onRetry={onRetry}
      errorTitle={t("students.loadFailed")}
      errorHint={t("students.loadFailedHint")}
      viewMode={viewMode}
      skeletonColumnCount={columnLayout.columnRegistry.length}
      useServerWork={useServerWork}
      pageData={workPageData}
      onPageChange={onPageChange}
      i18nNamespace="students"
      showPagination={workStudents.length > 0}
      loadingLabel={t("common.loading")}
    >
      {workStudents.length === 0 ? (
        <ModuleWorkDirectoryEmpty
          icon={GraduationCap}
          title={
            hasActiveFilters
              ? t("students.noStudentsMatchFilters")
              : viewingDeleted
                ? t("students.noDeletedStudents")
                : t("students.noStudentsYet")
          }
          description={emptyDescription}
          hasActiveFilters={hasActiveFilters}
          viewingDeleted={viewingDeleted}
          onClearFilters={onClearFilters}
          onShowActive={onShowActive}
          clearFiltersLabel={t("students.clearFilters")}
          showActiveLabel={t("students.showActive")}
        />
      ) : (
        <StudentsListContent
          students={workStudents}
          viewMode={viewMode}
          isColumnVisible={columnLayout.isColumnVisible}
          columnRegistry={columnLayout.columnRegistry}
          getColumnWidth={columnLayout.getColumnWidth}
          onColumnResize={columnLayout.setColumnWidth}
          viewingDeleted={viewingDeleted}
          canWrite={canWrite}
          {...listProps}
        />
      )}
    </ModuleWorkListStateShell>
  );
}
