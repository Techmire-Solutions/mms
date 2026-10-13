import { useState, useCallback } from "react";
import { useMessagingMetrics } from "@/tenant/hooks/collections/messaging";
import { getChannelLabelKey } from "@mms/shared";
import {
  MESSAGING_CHANNEL_CONFIG,
  type MessagingChannelConfig,
} from "@/tenant/hooks/collections/messaging";
import {
  exportMessagingLogsFiltered,
  messagingExportEndDateBound,
} from "@/tenant/hooks/collections/messaging";
import { calculateReportDateRange } from "@/lib/reports/reportDateUtils";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ExportColumn } from "@/components/ui/ExportToolbar";
import type { ChannelSummaryRow } from "@/components/ui/reports/MessagingReportSummaryTable";

export function useMessagingReportData(t: TranslationFunction, canWrite: boolean) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  const queryStartDate = startDate.trim() || undefined;
  const queryEndDate = endDate.trim() ? messagingExportEndDateBound(endDate) : undefined;

  const metricsQuery = useMessagingMetrics({
    startDate: queryStartDate,
    endDate: queryEndDate,
  });

  const stats = metricsQuery.data;
  const total = stats?.total ?? 0;

  const chartData = (() => {
    if (!stats) return [];
    return (Object.values(MESSAGING_CHANNEL_CONFIG) as MessagingChannelConfig[])
      .map((config) => {
        const value = (stats[`${config.id}Count` as keyof typeof stats] as number) ?? 0;
        return {
          name: t(getChannelLabelKey(config.id)),
          value,
          fillColor: `var(--color-${config.themeAccent})`,
        };
      })
      .filter((item) => item.value > 0);
  })();

  const showSkeleton = metricsQuery.isPending && !metricsQuery.data;

  const calcPercentage = useCallback(
    (count: number): string => {
      if (total === 0) return "0%";
      return `${Math.round((count / total) * 100)}%`;
    },
    [total],
  );

  const applyPreset = (days?: number): void => {
    if (days === undefined) {
      setStartDate("");
      setEndDate("");
      return;
    }
    const preset = days === 0 ? "today" : days === 7 ? "7d" : days === 30 ? "30d" : "none";
    const range = calculateReportDateRange(preset);
    setStartDate(range.from);
    setEndDate(range.to);
  };

  const exportAllFilteredLogs = async (): Promise<void> => {
    if (!canWrite || exporting) return;
    setExporting(true);
    try {
      await exportMessagingLogsFiltered({
        channel: "all",
        category: "all",
        debouncedSearch: "",
        status: "all",
        startDate: queryStartDate,
        endDate,
        t,
      });
    } catch {
      notify.error(t("messaging.exportFailed"), { description: t("messaging.loadFailedHint") });
    } finally {
      setExporting(false);
    }
  };

  const channelExportColumns = [
    { key: "channel", header: t("messaging.channel") },
    { key: "count", header: t("common.details") },
    { key: "rate", header: t("reports.kpi.growthRate") },
  ] as ExportColumn[];

  const channelSummaryRows = (() => {
    if (!stats) return [];
    return (Object.values(MESSAGING_CHANNEL_CONFIG) as MessagingChannelConfig[]).map((config) => {
      const count = (stats[`${config.id}Count` as keyof typeof stats] as number) ?? 0;
      return {
        id: config.id,
        channel: t(getChannelLabelKey(config.id)),
        count,
        rate: calcPercentage(count),
        accent: config.themeAccent,
      };
    });
  })() as ChannelSummaryRow[];

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    exporting,
    metricsQuery,
    stats,
    total,
    chartData,
    showSkeleton,
    calcPercentage,
    applyPreset,
    exportAllFilteredLogs,
    channelExportColumns,
    channelSummaryRows,
  };
}
