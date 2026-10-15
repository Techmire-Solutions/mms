import React from "react";
import { Activity, ShieldAlert, Download, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformActivityLogs } from "@/platform/hooks/usePlatformActivityLogs";
import { WidgetCard } from "@/components/app/WidgetCard";
import { WidgetCardHeader } from "@/components/app/WidgetCardHeader";
import { CardSkeleton } from "@/components/app/LoadingState";
import { ErrorState } from "@/components/app/ErrorState";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@shared/ui";
import { ModuleWorkToolbar } from "@/components/app/ModuleWorkToolbar";
import { SubTabBar } from "@/components/app/SubTabBar";
import { exportActivityLogsCsv } from "./activity-logs/exportActivityLogsCsv";
import { useActivityLogsFilter, type LogTimeframe } from "./activity-logs/useActivityLogsFilter";
import type { LogCategory } from "./activity-logs/activityLogMeta";
import { PlatformActivityLogsTimeline } from "./activity-logs/PlatformActivityLogsTimeline";
import { ActivityLogInspectModal } from "./activity-logs/ActivityLogInspectModal";
import type { PlatformActivityLogItem } from "@/platform/hooks/usePlatformActivityLogs";

export function PlatformActivityLogsContent(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: logs, isLoading, isError, refetch, isFetching } = usePlatformActivityLogs();
  const [inspectLog, setInspectLog] = React.useState<PlatformActivityLogItem | null>(null);

  const {
    filterQuery,
    setFilterQuery,
    category,
    setCategory,
    timeframe,
    setTimeframe,
    handleClearFilters,
    isFiltered,
    items,
  } = useActivityLogsFilter(logs);

  if (isLoading) return <CardSkeleton count={3} className="grid-cols-1" />;

  if (isError) {
    return (
      <ErrorState
        title={t("platform.loadFailed")}
        description={t("platform.loadFailedHint")}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 w-full text-start">
      <ModuleWorkToolbar
        regionLabel={t("platform.activityLogsTitle")}
        search={filterQuery}
        onSearchChange={setFilterQuery}
        searchPlaceholder={t("platform.filterLogsPlaceholder")}
        searchId="platform-logs-search"
        isSearching={isFetching}
        hasActiveFilters={isFiltered}
        onClearFilters={handleClearFilters}
        clearFiltersLabel={t("common.clearFilters")}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              loading={isFetching}
              onClick={() => void refetch()}
              className="min-w-11"
              title={t("common.refresh")}
              aria-label={t("common.refresh")}
            />

            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => exportActivityLogsCsv(items)}
              disabled={items.length === 0}
              title={t("platform.exportCsv")}
            >
              {t("platform.exportCsv")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <SubTabBar
            tabs={[
              { key: "all", label: t("platform.logs.categoryAll") },
              { key: "auth", label: t("platform.logs.categoryAuth") },
              { key: "workspace", label: t("platform.logs.categoryWorkspace") },
              { key: "system", label: t("platform.logs.categorySystem") },
              { key: "admin", label: t("platform.logs.categoryAdmin") },
            ]}
            value={category}
            onChange={(k) => setCategory(k as LogCategory)}
          />

          <SubTabBar
            tabs={[
              { key: "all", label: t("platform.logs.timeAll") },
              { key: "today", label: t("platform.logs.timeToday") },
              { key: "7d", label: t("platform.logs.timeWeek") },
              { key: "30d", label: t("platform.logs.timeMonth") },
            ]}
            value={timeframe}
            onChange={(k) => setTimeframe(k as LogTimeframe)}
          />
        </div>
      </ModuleWorkToolbar>

      <WidgetCard className="p-6 space-y-6">
        <WidgetCardHeader
          icon={<Activity className="w-5 h-5 text-primary" />}
          title={t("platform.activityLogsTitle")}
          subtitle={t("platform.activityLogsSubtitle")}
        />

        {items.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={isFiltered ? t("platform.noMatchingLogs") : t("platform.noActivityLogsYet")}
            action={
              isFiltered ? (
                <Button variant="outline" onClick={handleClearFilters}>
                  {t("common.clearFilters")}
                </Button>
              ) : undefined
            }
            compact
          />
        ) : (
          <PlatformActivityLogsTimeline logs={items} onInspect={setInspectLog} />
        )}
      </WidgetCard>

      <ActivityLogInspectModal log={inspectLog} onClose={() => setInspectLog(null)} />
    </div>
  );
}

export default PlatformActivityLogsContent;
