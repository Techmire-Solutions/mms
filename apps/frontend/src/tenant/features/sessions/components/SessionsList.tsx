import { BookOpen, Plus } from "lucide-react";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleWorkListStateShell } from "@/components/ui/ModuleWorkListStateShell";
import { type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionSortField } from "@/tenant/features/sessions/components/sessionPageTypes";
import type { Session } from "@/lib/data/sessionsData";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import { SessionsBulkActionBar } from "@/tenant/features/sessions/components/SessionsBulkActionBar";
import { SessionsListCards } from "@/tenant/features/sessions/components/SessionsListCards";
import { SessionsListDesktopTable } from "@/tenant/features/sessions/components/SessionsListDesktopTable";

interface SessionsWorkPageData {
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
}

interface SessionsWorkColumnLayout {
  getColumnWidth: (key: string) => number | undefined;
  setColumnWidth: (key: string, width: number) => void;
  columnRegistry: ModuleColumnRegistryEntry[];
}

interface SessionsWorkListProps {
  sessions: Session[];
  workPageData?: SessionsWorkPageData;
  isError: boolean;
  isWorkLoading: boolean;
  isWorkFetching: boolean;
  useServerWork: boolean;
  viewMode: WorkDirectoryViewMode;
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canSelectSessions: boolean;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  isColumnVisible: (key: string) => boolean;
  sortField: SessionSortField;
  sortDir: "asc" | "desc";
  columnLayout: SessionsWorkColumnLayout;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  onRetry: () => void;
  onCreateSession: () => void;
  onOpenDetail: (session: Session) => void;
  onSort: (field: SessionSortField) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedSession: (id: string, checked: boolean) => void;
  onRequestDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onRequestBulkDelete: () => void;
  onRequestBulkRestore: () => void;
  onBulkStatusChange?: (status: string) => void;
  statusPending?: boolean;
  onClearSelection: () => void;
  onPageChange: (page: number) => void;
  canExport?: boolean;
  onBulkExport?: () => void;
}

export function SessionsList({
  sessions,
  workPageData,
  isError,
  isWorkLoading,
  isWorkFetching,
  useServerWork,
  viewMode,
  showDeleted,
  canWrite,
  canDelete,
  canSelectSessions,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  isColumnVisible,
  sortField,
  sortDir,
  columnLayout,
  statusConfig,
  typeConfig,
  onRetry,
  onCreateSession,
  onOpenDetail,
  onSort,
  onToggleSelectAll,
  onToggleSelectedSession,
  onRequestDelete,
  onRestore,
  onRequestBulkDelete,
  onRequestBulkRestore,
  onBulkStatusChange,
  statusPending = false,
  onClearSelection,
  onPageChange,
  canExport = false,
  onBulkExport,
}: SessionsWorkListProps) {
  const { t } = useTranslation();

  return (
    <>
      <SessionsBulkActionBar
        selectedCount={selectedIds.length}
        showDeleted={showDeleted}
        canWrite={canWrite}
        canDelete={canDelete}
        canExport={canExport}
        statusConfig={statusConfig}
        onBulkStatusChange={onBulkStatusChange}
        statusPending={statusPending}
        onRequestBulkDelete={onRequestBulkDelete}
        onRequestBulkRestore={onRequestBulkRestore}
        onClearSelection={onClearSelection}
        onBulkExport={onBulkExport}
      />

      <ModuleWorkListStateShell
        isError={isError}
        isLoading={isWorkLoading}
        isFetching={isWorkFetching}
        onRetry={onRetry}
        errorTitle={t("sessions.loadFailed")}
        errorHint={t("sessions.loadFailedHint")}
        viewMode={viewMode}
        skeletonColumnCount={viewMode === "table" ? 6 : 3}
        useServerWork={useServerWork}
        pageData={workPageData}
        onPageChange={onPageChange}
        i18nNamespace="sessions"
        showPagination={sessions.length > 0}
        loadingLabel={t("common.loading")}
      >
        {sessions.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={showDeleted ? t("sessions.empty.trashTitle") : t("sessions.empty.title")}
            description={
              showDeleted ? t("sessions.empty.trashSubtitle") : t("sessions.empty.subtitle")
            }
            action={
              !showDeleted && canWrite ? (
                <Button variant="primary" icon={Plus} onClick={onCreateSession}>
                  {t("sessions.action.new")}
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === "table" ? (
          <SessionsListDesktopTable
            sessions={sessions}
            showDeleted={showDeleted}
            canDelete={canDelete}
            canSelectSessions={canSelectSessions}
            selectedIds={selectedIds}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            isColumnVisible={isColumnVisible}
            sortField={sortField}
            sortDir={sortDir}
            columnLayout={columnLayout}
            statusConfig={statusConfig}
            typeConfig={typeConfig}
            onOpenDetail={onOpenDetail}
            onSort={onSort}
            onToggleSelectAll={onToggleSelectAll}
            onToggleSelectedSession={onToggleSelectedSession}
            onRequestDelete={onRequestDelete}
            onRestore={onRestore}
          />
        ) : (
          <SessionsListCards
            sessions={sessions}
            showDeleted={showDeleted}
            canDelete={canDelete}
            canSelectSessions={canSelectSessions}
            selectedIds={selectedIds}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            isColumnVisible={isColumnVisible}
            columnRegistry={columnLayout.columnRegistry}
            statusConfig={statusConfig}
            typeConfig={typeConfig}
            onOpenDetail={onOpenDetail}
            onRequestDelete={onRequestDelete}
            onRestore={onRestore}
            onToggleSelectAll={onToggleSelectAll}
            onToggleSelectedSession={onToggleSelectedSession}
          />
        )}
      </ModuleWorkListStateShell>
    </>
  );
}
