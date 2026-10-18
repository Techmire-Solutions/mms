import type React from "react";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ErrorState } from "@/components/app/ErrorState";
import { SubTabBar } from "@/components/app/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { EnrollmentsBulkActionBar } from "@/tenant/features/enrollments/components/EnrollmentsBulkActionBar";
import { EligibilityCheck } from "@/tenant/features/enrollments/components/EligibilityCheck";
import { AdmissionsPanel } from "@/tenant/features/enrollments/components/admissions/AdmissionsPanel";
import { EnrollmentsList } from "@/tenant/features/enrollments/components/EnrollmentsList";
import type { Enrollment } from "@/lib/data/enrollmentData";

export type EnrollmentSubTab = {
  id: string;
  label: string;
};

export type EnrollmentColumnProps = Pick<
  React.ComponentProps<typeof EnrollmentsList>,
  "isColumnVisible" | "getColumnWidth" | "onColumnResize" | "columnCustomizer"
>;

export interface EnrollmentsWorkTierProps {
  activeSubTab: string;
  subTabs: EnrollmentSubTab[];
  enrollments: Enrollment[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  statusFilter: string;
  sessionFilter: string;
  canWrite: boolean;
  canDelete: boolean;
  canExport: boolean;
  canSelectEnrollments: boolean;
  showDeleted: boolean;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  isWorkListError: boolean;
  loadFailedTitle: string;
  onSubTabChange: (next: string) => void;
  onRetry: () => void;
  onShowDeletedChange: (showDeleted: boolean) => void;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onSessionFilterChange: (sessionId: string) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onView: (enrollment: Enrollment) => void;
  onCancel: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  onRestore: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedEnrollment: (id: string, checked: boolean) => void;
  onClearSelection: () => void;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onRequestBulkCancel: () => void;
  onBulkExport: () => void;
  columnProps: EnrollmentColumnProps;
}

export function EnrollmentsWorkTier({
  activeSubTab,
  subTabs,
  enrollments,
  total,
  page,
  pageSize,
  search,
  statusFilter,
  sessionFilter,
  canWrite,
  canDelete,
  canExport,
  canSelectEnrollments,
  showDeleted,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  isWorkListError,
  loadFailedTitle,
  onSubTabChange,
  onRetry,
  onShowDeletedChange,
  onSearchChange,
  onStatusFilterChange,
  onSessionFilterChange,
  onClearFilters,
  onPageChange,
  onView,
  onCancel,
  onDeleteRequest,
  onRestore,
  onToggleSelectAll,
  onToggleSelectedEnrollment,
  onClearSelection,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onRequestBulkCancel,
  onBulkExport,
  columnProps,
}: EnrollmentsWorkTierProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <SubTabBar
        tabs={subTabs
          .filter((item) => canWrite || item.id !== "eligibility")
          .map((item) => ({ key: item.id, label: item.label }))}
        value={activeSubTab}
        onChange={onSubTabChange}
      />

      {activeSubTab === "directory" && (
        <ErrorBoundary>
          {isWorkListError ? (
            <ErrorState
              title={loadFailedTitle}
              description={t("enrollments.loadFailedHint")}
              onRetry={onRetry}
            />
          ) : (
            <>
              <EnrollmentsBulkActionBar
                selectedCount={selectedIds.length}
                showDeleted={showDeleted}
                canDelete={canDelete}
                canCancel={canWrite}
                canExport={canExport}
                onRequestBulkDelete={onRequestBulkDelete}
                onRequestBulkRestore={onRequestBulkRestore}
                onRequestBulkCancel={onRequestBulkCancel}
                onClearSelection={onClearSelection}
                onBulkExport={onBulkExport}
              />
              <EnrollmentsList
                enrollments={enrollments}
                total={total}
                page={page}
                pageSize={pageSize}
                search={search}
                statusFilter={statusFilter}
                sessionFilter={sessionFilter}
                canWrite={canWrite}
                canDelete={canDelete}
                canSelectEnrollments={canSelectEnrollments}
                showDeleted={showDeleted}
                selectedIds={selectedIds}
                allVisibleSelected={allVisibleSelected}
                someVisibleSelected={someVisibleSelected}
                onShowDeletedChange={onShowDeletedChange}
                onSearchChange={onSearchChange}
                onStatusFilterChange={onStatusFilterChange}
                onSessionFilterChange={onSessionFilterChange}
                onClearFilters={onClearFilters}
                onPageChange={onPageChange}
                onView={onView}
                onCancel={onCancel}
                onDelete={onDeleteRequest}
                onRestore={onRestore}
                onToggleSelectAll={onToggleSelectAll}
                onToggleSelectedEnrollment={onToggleSelectedEnrollment}
                {...columnProps}
              />
            </>
          )}
        </ErrorBoundary>
      )}

      {activeSubTab === "eligibility" && (
        <ErrorBoundary>
          <EligibilityCheck />
        </ErrorBoundary>
      )}

      {activeSubTab === "admissions" && (
        <ErrorBoundary>
          <AdmissionsPanel canWrite={canWrite} />
        </ErrorBoundary>
      )}
    </>
  );
}
