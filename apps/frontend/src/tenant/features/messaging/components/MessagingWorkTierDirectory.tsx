import React, { useState } from "react";
import { Archive, AlertTriangle, MessageSquareOff, RotateCcw, Send } from "lucide-react";
import type { Message } from "@mms/shared";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { ModuleTierMotion } from "@/components/app/ModuleTierMotion";
import { ModuleWorkDirectoryEmpty } from "@/components/app/ModuleWorkDirectoryEmpty";
import { ModuleWorkListStateShell } from "@/components/app/ModuleWorkListStateShell";
import { FilterChips } from "@/components/app/FilterChips";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/app/Alert";
import { SEMANTIC_TEXT } from "@/lib/ui/semanticTone";
import { MessagingDetail } from "./MessagingDetail";
import { MessagingWorkBulkActionBar } from "./MessagingWorkBulkActionBar";
import { MessagingListCards } from "./MessagingListCards";
import { MessagingListDesktopTable } from "./MessagingListDesktopTable";
import { MessagingListFilters } from "./MessagingListFilters";
import { resolveMessagingDirectoryCopy } from "../lib/messagingDirectoryCopy";
import type { useMessagingWorkTierController } from "../hooks/useMessagingWorkTierController";

type MessagingWorkTierDirectoryProps = ReturnType<typeof useMessagingWorkTierController> & {
  canWrite: boolean;
  canClearLogs: boolean;
  canRestoreLogs?: boolean;
  onRestoreLog?: (log: Message) => Promise<void>;
  /** Bulk restore of the selected archived logs. */
  onBulkRestore?: (ids: string[]) => Promise<void> | void;
  onClearLogsRequest: () => void;
  onStartCampaign?: (channel: "whatsapp" | "sms" | "email") => void;
};

export function MessagingWorkTierDirectory({
  canWrite,
  canClearLogs,
  canRestoreLogs,
  onRestoreLog,
  onBulkRestore,
  onClearLogsRequest,
  onStartCampaign,
  ...c
}: MessagingWorkTierDirectoryProps): React.JSX.Element {
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const selectedIds = Object.keys(c.selectedById);
  const emptyCopy = resolveMessagingDirectoryCopy({
    showArchived: c.showArchived,
    hasActiveFilters: c.hasActiveFilters,
  });

  return (
    <ModuleTierMotion tier="work-messaging" className="space-y-4">
      <ErrorBoundary
        fallback={
          <div className={`p-4 text-sm ${SEMANTIC_TEXT.destructive}`}>
            {c.t("errors.toolbar.loadFailed")}
          </div>
        }
      >
        <MessagingListFilters
          viewMode={c.viewMode}
          onViewModeChange={c.setViewMode}
          search={c.search}
          onSearchChange={c.setSearch}
          channel={c.channel}
          onChannelChange={c.setChannel}
          channelOptions={c.channelSelectOptions}
          status={c.status}
          onStatusChange={c.setStatus}
          statusOptions={c.statusOptions}
          category={c.category}
          onCategoryChange={c.setCategory}
          categoryOptions={c.categorySelectOptions}
          startDate={c.startDate}
          onStartDateChange={c.setStartDate}
          endDate={c.endDate}
          onEndDateChange={c.setEndDate}
          hasActiveFilters={c.hasActiveFilters}
          activeFilterCount={c.activeFilterCount}
          onClearFilters={c.clearFilters}
          columnRegistry={c.columnRegistry}
          updateUserColumnLayout={c.updateUserColumnLayout}
          columnCustomizerLabels={c.customizerLabels}
          shownCount={c.logsQuery.logs.length}
          shownTotal={c.logsQuery.total}
          showArchived={c.showArchived}
          onShowArchivedChange={c.canViewArchived ? c.setShowArchived : undefined}
          filterChips={<FilterChips chips={c.filterChips} onClearAll={c.clearFilters} />}
        />
      </ErrorBoundary>

      {c.showArchived && (
        <Alert
          tone="info"
          density="compact"
          icon={Archive}
          title={c.t("messaging.showArchived")}
          action={
            <Button
              variant="link"
              size="sm"
              onClick={() => c.setShowArchived(false)}
              className="min-h-11 shrink-0 px-2 text-xs font-semibold"
            >
              {c.t("messaging.showActiveLogs")}
            </Button>
          }
        />
      )}

      {c.status === "failed" && c.failedLogs.length > 0 && (
        <Alert
          tone="destructive"
          density="compact"
          icon={AlertTriangle}
          title={c.t("messaging.failedOnPage", { count: c.failedLogs.length })}
          action={
            canWrite && c.hasBulkResend ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => c.handleBulkResendLogs(c.failedLogs)}
                className="h-8 gap-1 text-xs border-destructive/40 text-destructive hover:bg-destructive/15 font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{c.t("messaging.resend")}</span>
              </Button>
            ) : undefined
          }
        />
      )}

      {c.selectedCount > 0 && (
        <MessagingWorkBulkActionBar
          selectedCount={c.selectedCount}
          canWrite={canWrite}
          canClearLogs={!c.showArchived && canClearLogs}
          viewingDeleted={c.showArchived}
          canRestoreLogs={Boolean(canRestoreLogs)}
          onClearSelection={() => c.setSelectedById({})}
          onBulkExport={() => void c.handleExportLogs()}
          onBulkResend={c.handleBulkResend}
          onClearLogsRequest={onClearLogsRequest}
          onBulkRestoreRequest={() => setBulkRestoreOpen(true)}
        />
      )}

      <ConfirmAlertDialog
        open={bulkRestoreOpen}
        onOpenChange={(open) => {
          if (!open) setBulkRestoreOpen(false);
        }}
        title={c.t("messaging.restoreLog")}
        description={c.t("messaging.bulkRestoreConfirm", { count: selectedIds.length })}
        confirmLabel={c.t("messaging.restoreLog")}
        onConfirm={() => {
          setBulkRestoreOpen(false);
          void onBulkRestore?.(selectedIds);
        }}
      />

      <ModuleWorkListStateShell
        isError={c.logsQuery.isError}
        isLoading={c.logsQuery.isPending && c.logsQuery.logs.length === 0}
        isFetching={c.logsQuery.isFetching}
        onRetry={c.logsQuery.refetch}
        errorTitle={c.t("messaging.loadFailed")}
        errorHint={c.t("messaging.loadFailedHint")}
        viewMode={c.viewMode}
        skeletonColumnCount={5}
        useServerWork={true}
        pageData={{
          page: c.logsQuery.page,
          total: c.logsQuery.total,
          limit: c.logsQuery.pageSize,
          hasMore: c.logsQuery.hasMore,
        }}
        onPageChange={c.setLogsPage}
        i18nNamespace="messaging"
        showPagination={c.logsQuery.logs.length > 0}
        loadingLabel={c.t("common.loading")}
      >
        {c.logsQuery.logs.length === 0 ? (
          <ModuleWorkDirectoryEmpty
            icon={MessageSquareOff}
            title={c.t(emptyCopy.titleKey)}
            description={c.t(emptyCopy.descriptionKey)}
            hasActiveFilters={c.hasActiveFilters}
            viewingDeleted={c.showArchived}
            onClearFilters={c.clearFilters}
            onShowActive={c.showArchived ? () => c.setShowArchived(false) : undefined}
            clearFiltersLabel={c.t("common.clearFilters")}
            showActiveLabel={c.t("messaging.showActiveLogs")}
            firstRunAction={
              emptyCopy.showFirstRunAction && canWrite && onStartCampaign ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => onStartCampaign("whatsapp")}
                  className="gap-1.5 min-h-11 px-3 font-semibold"
                >
                  <Send className="h-3.5 w-3.5" />
                  {c.t("messaging.newCampaign")}
                </Button>
              ) : undefined
            }
          />
        ) : c.viewMode === "cards" ? (
          <MessagingListCards
            logs={c.logsQuery.logs}
            selectedIds={c.selectedById}
            allVisibleSelected={c.allVisibleSelected}
            someVisibleSelected={c.someVisibleSelected}
            selectedCountLabel={c.selectedCountLabel}
            pageCountLabel={c.pageCountLabel}
            canWrite={canWrite}
            logStatusConfig={c.logStatusConfig}
            getRecipientName={c.getRecipientName}
            isColumnVisible={c.isColumnVisible}
            focusedLogId={c.focusedLogId}
            onToggleLog={c.toggleLog}
            onToggleAllVisible={c.toggleAllVisible}
            onResendLog={c.handleResendLog}
            onViewLog={c.handleOpenDetail}
            onFilterContact={c.handleFilterContact}
          />
        ) : (
          <MessagingListDesktopTable
            logs={c.logsQuery.logs}
            selectedIds={c.selectedById}
            allVisibleSelected={c.allVisibleSelected}
            someVisibleSelected={c.someVisibleSelected}
            canWrite={canWrite}
            logStatusConfig={c.logStatusConfig}
            getRecipientName={c.getRecipientName}
            getColumnWidth={c.getColumnWidth}
            isColumnVisible={c.isColumnVisible}
            setColumnWidth={c.setColumnWidth}
            focusedLogId={c.focusedLogId}
            onToggleLog={c.toggleLog}
            onToggleAllVisible={c.toggleAllVisible}
            onResendLog={c.handleResendLog}
            onViewLog={c.handleOpenDetail}
            onFilterContact={c.handleFilterContact}
            pageCountLabel={c.pageCountLabel}
          />
        )}
      </ModuleWorkListStateShell>

      <MessagingDetail
        log={c.activeDetailLog}
        recipient={c.activeRecipient}
        logStatusConfig={c.logStatusConfig}
        canWrite={canWrite}
        canRestoreLogs={canRestoreLogs}
        onRestoreLog={onRestoreLog}
        onClose={c.handleCloseDetail}
        onResend={c.handleResendLog}
      />
    </ModuleTierMotion>
  );
}
