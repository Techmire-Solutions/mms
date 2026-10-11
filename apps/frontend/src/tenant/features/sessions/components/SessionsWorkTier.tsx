import { ModuleTierMotion } from "@/components/ui/ModuleTierMotion";
import type { SessionsListPageResult } from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { Session } from "@/lib/data/sessionsData";
import { SessionsListFilters } from "@/tenant/features/sessions/components/SessionsListFilters";
import { SessionsList } from "@/tenant/features/sessions/components/SessionsList";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type {
  SessionSortField,
  SessionStatus,
  SessionType,
} from "@/tenant/features/sessions/components/sessionPageTypes";

interface SessionsColumnLayout {
  isColumnVisible: (key: string) => boolean;
  getColumnWidth: (key: string) => number | undefined;
  setColumnWidth: (key: string, width: number) => void;
  columnRegistry: Parameters<typeof SessionsListFilters>[0]["columnLayout"]["columnRegistry"];
  updateUserColumnLayout: Parameters<
    typeof SessionsListFilters
  >[0]["columnLayout"]["updateUserColumnLayout"];
  customizerLabels: Parameters<typeof SessionsListFilters>[0]["columnLayout"]["customizerLabels"];
  resetColumnLayout?: () => void;
}

interface SessionsWorkTierProps {
  search: string;
  filterStatus: SessionStatus[];
  filterType: SessionType[];
  statusOptions: string[];
  typeOptions: string[];
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  columnLayout: SessionsColumnLayout;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  sessions: Session[];
  workPageData?: SessionsListPageResult;
  isError: boolean;
  isWorkLoading: boolean;
  isWorkFetching: boolean;
  useServerWork: boolean;
  canSelectSessions: boolean;
  selectedIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  sortField: SessionSortField;
  sortDir: "asc" | "desc";
  statusConfig: Record<string, StatusBadgeConfigItem>;
  typeConfig: Record<string, StatusBadgeConfigItem>;
  onSearchChange: (value: string) => void;
  onStatusFilterToggle: (status: SessionStatus) => void;
  onTypeFilterToggle: (type: SessionType) => void;
  onClearFilters: () => void;
  onToggleDeleted: () => void;
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
  onBulkStatusChange?: (ids: string[], status: string) => void | Promise<void>;
  bulkStatusPending?: boolean;
  onClearSelection: () => void;
  onPageChange: (page: number) => void;
  canExport?: boolean;
  onBulkExport?: () => void;
}

export function SessionsWorkTier({
  search,
  filterStatus,
  filterType,
  statusOptions,
  typeOptions,
  statusLabels,
  typeLabels,
  viewMode,
  onViewModeChange,
  columnLayout,
  canWrite,
  canDelete,
  showDeleted,
  sessions,
  workPageData,
  isError,
  isWorkLoading,
  isWorkFetching,
  useServerWork,
  canSelectSessions,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  sortField,
  sortDir,
  statusConfig,
  typeConfig,
  onSearchChange,
  onStatusFilterToggle,
  onTypeFilterToggle,
  onClearFilters,
  onToggleDeleted,
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
  bulkStatusPending,
  onClearSelection,
  onPageChange,
  canExport,
  onBulkExport,
}: SessionsWorkTierProps): React.JSX.Element {
  const activeFilterCount = filterStatus.length + filterType.length;

  const handleBulkStatusChange = onBulkStatusChange
    ? (status: string) => {
        void onBulkStatusChange(selectedIds, status);
      }
    : undefined;

  return (
    <ModuleTierMotion
      tier="work"
      className="space-y-5"
      aria-busy={useServerWork && isWorkFetching ? true : undefined}
    >
      <SessionsListFilters
        search={search}
        onSearchChange={onSearchChange}
        filterStatus={filterStatus}
        filterType={filterType}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        statusLabels={statusLabels}
        typeLabels={typeLabels}
        activeFilterCount={activeFilterCount}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        columnLayout={columnLayout}
        canDelete={canDelete}
        showDeleted={showDeleted}
        onStatusFilterToggle={onStatusFilterToggle}
        onTypeFilterToggle={onTypeFilterToggle}
        onClearFilters={onClearFilters}
        onToggleDeleted={onToggleDeleted}
      />

      <SessionsList
        sessions={sessions}
        workPageData={useServerWork ? workPageData : undefined}
        isError={isError}
        isWorkLoading={isWorkLoading}
        isWorkFetching={useServerWork && isWorkFetching}
        useServerWork={useServerWork}
        viewMode={viewMode}
        showDeleted={showDeleted}
        canWrite={canWrite}
        canDelete={canDelete}
        canSelectSessions={canSelectSessions}
        selectedIds={selectedIds}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        isColumnVisible={columnLayout.isColumnVisible}
        sortField={sortField}
        sortDir={sortDir}
        columnLayout={columnLayout}
        statusConfig={statusConfig}
        typeConfig={typeConfig}
        onRetry={onRetry}
        onCreateSession={onCreateSession}
        onOpenDetail={onOpenDetail}
        onSort={onSort}
        onToggleSelectAll={onToggleSelectAll}
        onToggleSelectedSession={onToggleSelectedSession}
        onRequestDelete={onRequestDelete}
        onRestore={onRestore}
        onRequestBulkDelete={onRequestBulkDelete}
        onRequestBulkRestore={onRequestBulkRestore}
        onBulkStatusChange={handleBulkStatusChange}
        statusPending={bulkStatusPending}
        onClearSelection={onClearSelection}
        onPageChange={onPageChange}
        canExport={canExport}
        onBulkExport={onBulkExport}
      />
    </ModuleTierMotion>
  );
}
