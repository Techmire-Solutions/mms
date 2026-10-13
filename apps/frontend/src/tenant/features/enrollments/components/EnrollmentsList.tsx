import React from "react";
import { type Enrollment } from "@/lib/data/enrollmentData";
import { useTranslation } from "@/hooks/useTranslation";
import { useWorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { useStudentsByIds } from "@/tenant/hooks/collections/students";
import type { ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useMessageComposerState } from "@/hooks/useMessageComposerState";
import { EnrollmentsListContent } from "@/tenant/features/enrollments/components/EnrollmentsListContent";
import { EnrollmentsListFilters } from "@/tenant/features/enrollments/components/EnrollmentsListFilters";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

const MessageComposer = React.lazy(
  () => import("@/tenant/components/messaging/TenantMessageComposer"),
);

const ALWAYS_COLUMN_VISIBLE = (_key: string): boolean => true;

export interface EnrollmentListProps {
  enrollments: Enrollment[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  statusFilter: string;
  sessionFilter: string;
  canWrite: boolean;
  canDelete?: boolean;
  canSelectEnrollments: boolean;
  showDeleted?: boolean;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  onShowDeletedChange?: (showDeleted: boolean) => void;
  onSearchChange: (search: string) => void;
  onStatusFilterChange: (status: string) => void;
  onSessionFilterChange: (sessionId: string) => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onView: (enrollment: Enrollment) => void;
  onCancel: (id: string) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedEnrollment: (id: string, checked: boolean) => void;
  isColumnVisible?: (key: string) => boolean;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  columnCustomizer: ModuleColumnCustomizerProps;
}

/**
 * Renders a server-paginated, filterable table/list of enrollment records.
 */
export function EnrollmentsList({
  enrollments,
  total,
  page,
  pageSize,
  search,
  statusFilter,
  sessionFilter,
  canWrite,
  canDelete = false,
  canSelectEnrollments,
  showDeleted = false,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  onShowDeletedChange,
  onSearchChange,
  onStatusFilterChange,
  onSessionFilterChange,
  onClearFilters,
  onPageChange,
  onView,
  onCancel,
  onDelete,
  onRestore,
  onToggleSelectAll,
  onToggleSelectedEnrollment,
  isColumnVisible,
  getColumnWidth,
  onColumnResize,
  columnCustomizer,
}: EnrollmentListProps): React.JSX.Element {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useWorkDirectoryViewMode();
  const { formatCurrency } = useFinanceCurrency();
  const { messagingTarget, openComposer, closeComposer } = useMessageComposerState();
  const sessions = useSessionsCollection();
  const { data: students = [] } = useStudentsByIds(
    enrollments.map((enrollment) => enrollment.studentId),
  );
  const columnVisible = isColumnVisible ?? ALWAYS_COLUMN_VISIBLE;

  const statusConfig = (() => ({
    pending: { label: t("enrollments.status.pending"), cls: SEMANTIC_BADGE.warning },
    confirmed: { label: t("enrollments.status.confirmed"), cls: SEMANTIC_BADGE.success },
    cancelled: { label: t("enrollments.status.cancelled"), cls: SEMANTIC_BADGE.destructive },
    completed: { label: t("enrollments.status.completed"), cls: SEMANTIC_BADGE.info },
  }))() as Record<string, StatusBadgeConfigItem>;

  const paymentConfig = (() => ({
    paid: { label: t("enrollments.payment.paid"), cls: SEMANTIC_BADGE.success },
    pending: { label: t("enrollments.payment.pending"), cls: SEMANTIC_BADGE.warning },
    none: { label: t("enrollments.payment.none"), cls: SEMANTIC_BADGE.muted },
  }))() as Record<string, StatusBadgeConfigItem>;

  return (
    <section className="space-y-4" aria-label={t("enrollments.list")}>
      <EnrollmentsListFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        statusFilter={statusFilter}
        sessionFilter={sessionFilter}
        sessions={sessions}
        showDeleted={showDeleted}
        canDelete={canDelete}
        statusConfig={statusConfig}
        columnCustomizer={columnCustomizer}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusFilterChange}
        onSessionChange={onSessionFilterChange}
        onClearFilters={onClearFilters}
        onShowDeletedChange={onShowDeletedChange}
      />

      <EnrollmentsListContent
        viewMode={viewMode}
        enrollments={enrollments}
        filteredCount={total}
        page={page}
        pageSize={pageSize}
        students={students}
        isColumnVisible={columnVisible}
        columnRegistry={columnCustomizer.columnRegistry ?? []}
        canSelectEnrollments={canSelectEnrollments}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        canWrite={canWrite}
        canDelete={canDelete}
        showDeleted={showDeleted}
        statusConfig={statusConfig}
        paymentConfig={paymentConfig}
        formatCurrency={formatCurrency}
        getColumnWidth={getColumnWidth}
        onColumnResize={onColumnResize}
        onPageChange={onPageChange}
        onView={onView}
        onCancel={onCancel}
        onDelete={onDelete}
        onRestore={onRestore}
        onToggleSelectAll={onToggleSelectAll}
        onToggleSelectedEnrollment={onToggleSelectedEnrollment}
        openComposer={openComposer}
      />

      {messagingTarget && (
        <React.Suspense fallback={null}>
          <MessageComposer
            channel={messagingTarget.channel}
            recipients={messagingTarget.recipients}
            onClose={closeComposer}
          />
        </React.Suspense>
      )}
    </section>
  );
}
