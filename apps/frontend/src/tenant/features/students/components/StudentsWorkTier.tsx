import { useMemo } from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { FilterChips } from "@/components/app/FilterChips";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { CompactSegmentedControl, type CompactSegmentedOption } from "@/components/app/CompactSegmentedControl";
import { STUDENTS_QUICK_FILTER_OPTIONS, type StudentsQuickFilter } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useStudentsWorkFilterChips } from "@/tenant/features/students/hooks/useStudentsWorkFilterChips";
import { StudentsBulkActionBar } from "@/tenant/features/students/components/StudentsBulkActionBar";
import { StudentsList } from "@/tenant/features/students/components/StudentsList";
import { StudentsListFilters } from "@/tenant/features/students/components/StudentsListFilters";
import type { StudentsWorkTierProps } from "@/tenant/features/students/lib/studentsWorkTierTypes";

export function StudentsWorkTier({
  studentSearch,
  studentFilterStatus,
  studentFilterGender,
  quickFilter,
  onQuickFilterChange,
  studentStatusOptions,
  genderFilters,
  viewingDeleted,
  canWrite,
  canDelete,
  canExport,
  isStatusEnabled = true,
  isGenderEnabled = true,
  bulkActions,
  hasActiveFilters,
  activeFilterCount,
  workStudents,
  workPageData,
  isWorkPageLoading,
  isWorkPageError,
  isWorkPageFetching,
  useServerWork,
  viewMode,
  onViewModeChange,
  columnLayout,
  onSearchChange,
  onToggleStatus,
  onGenderChange,
  onToggleDeleted,
  onClearFilters,
  selectedIds,
  selectedTargets,
  allSelected,
  someSelected,
  onSelectOne,
  onSelectAll,
  onClearSelection,
  onRetry,
  onPageChange,
  onEdit,
  onRestore,
  onBulkStatusChange,
  onBulkEnroll,
  bulkEnrollPending,
  onBulkPrintIdCards,
  onBulkExport,
  bulkStatusPending,
  sortField,
  sortDir,
  onServerSort,
  workOverlays,
}: StudentsWorkTierProps): React.JSX.Element {
  const { t } = useTranslation();
  const studentFilterChips = useStudentsWorkFilterChips({
    studentFilterStatus,
    studentFilterGender,
    onToggleStatus,
    onGenderChange,
  });

  const quickFilterSegmentOptions = useMemo<CompactSegmentedOption<StudentsQuickFilter>[]>(
    () =>
      STUDENTS_QUICK_FILTER_OPTIONS.map((opt) => ({
        value: opt.id,
        label: t(opt.labelKey),
      })),
    [t],
  );

  return (
    <ErrorBoundary>
      <ModuleTierMotion
        tier="work"
        className="space-y-5"
        aria-busy={useServerWork && isWorkPageFetching ? true : undefined}
      >
        <div className="overflow-x-auto pb-0.5">
          <CompactSegmentedControl<StudentsQuickFilter>
            value={quickFilter}
            onChange={(val) => onQuickFilterChange(val)}
            options={quickFilterSegmentOptions}
          />
        </div>

        <StudentsListFilters
          studentSearch={studentSearch}
          studentFilterStatus={studentFilterStatus}
          studentFilterGender={studentFilterGender}
          quickFilter={quickFilter}
          onQuickFilterChange={onQuickFilterChange}
          studentStatusOptions={studentStatusOptions}
          genderFilters={genderFilters}
          viewingDeleted={viewingDeleted}
          canDelete={canDelete}
          isStatusEnabled={isStatusEnabled}
          isGenderEnabled={isGenderEnabled}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          columnLayout={columnLayout}
          viewMode={viewMode}
          sortField={sortField}
          onViewModeChange={onViewModeChange}
          onSearchChange={onSearchChange}
          onToggleStatus={onToggleStatus}
          onGenderChange={onGenderChange}
          onSortChange={onServerSort}
          onToggleDeleted={onToggleDeleted}
          onClearFilters={onClearFilters}
          shownCount={workPageData?.total ?? 0}
          filterChips={
            studentFilterChips.length > 0 ? (
              <FilterChips chips={studentFilterChips} onClearAll={onClearFilters} />
            ) : undefined
          }
        />

        <StudentsBulkActionBar
          selectedCount={selectedIds.length}
          viewingDeleted={viewingDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          canWriteMessaging={workOverlays.canWriteMessaging}
          canExport={canExport}
          bulkActions={bulkActions}
          selectedTargets={selectedTargets}
          studentStatusOptions={studentStatusOptions}
          statusBadgeConfig={workOverlays.statusBadgeConfig}
          onWhatsApp={(targets) => workOverlays.openSelectionMessage("whatsapp", targets)}
          onSms={(targets) => workOverlays.openSelectionMessage("sms", targets)}
          onEmail={(targets) => workOverlays.openSelectionMessage("email", targets)}
          onBulkStatusChange={async (status) => {
            try {
              await onBulkStatusChange(selectedIds, status);
              onClearSelection();
            } catch {
              // Toast already emitted by the crud action; keep selection for retry.
            }
          }}
          onBulkEnroll={onBulkEnroll}
          isBulkEnrollPending={bulkEnrollPending}
          onBulkPrintIdCards={onBulkPrintIdCards}
          onBulkExport={() => {
            void onBulkExport();
          }}
          onRequestBulkDelete={() => {
            if (canDelete && selectedIds.length > 0) workOverlays.setConfirmBulkDeleteOpen(true);
          }}
          onRequestBulkRestore={() => {
            if (canDelete && selectedIds.length > 0) workOverlays.setConfirmBulkRestoreOpen(true);
          }}
          onClearSelection={onClearSelection}
          statusPending={bulkStatusPending}
        />

        <StudentsList
          isWorkPageLoading={isWorkPageLoading}
          isWorkPageError={isWorkPageError}
          isWorkPageFetching={isWorkPageFetching}
          onRetry={onRetry}
          workStudents={workStudents}
          workPageData={workPageData}
          useServerWork={useServerWork}
          viewMode={viewMode}
          columnLayout={columnLayout}
          onPageChange={onPageChange}
          selectedIds={selectedIds}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectOne={onSelectOne}
          onSelectAll={onSelectAll}
          viewingDeleted={viewingDeleted}
          canWrite={canWrite}
          canDelete={canDelete}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          onShowActive={() => {
            if (viewingDeleted) onToggleDeleted();
          }}
          sortField={sortField}
          sortDir={sortDir}
          onServerSort={onServerSort}
          onEdit={onEdit}
          onRestore={onRestore}
          onViewStudent={workOverlays.setViewStudent}
          openComposer={workOverlays.openComposer}
          canWriteMessaging={workOverlays.canWriteMessaging}
          onDeleteTargetChange={workOverlays.setDeleteTarget}
        />
      </ModuleTierMotion>
    </ErrorBoundary>
  );
}
