import React from "react";
import type { ActivityLog } from "@mms/shared";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { UsersCommandMetrics } from "@/tenant/components/reports/moduleReportAdapters";
import { ActivityLogs } from "@/tenant/components/reports/moduleReportAdapters";
import { useActivityLogs, useUsersByIds } from "@/tenant/hooks/collections/users";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTranslation } from "@/hooks/useTranslation";

import PinnedWidgets from "@/tenant/features/reports/components/PinnedWidgets";

export default function UsersReport(): React.JSX.Element {
  const { t } = useTranslation();
  const activityQuery = useActivityLogs();

  const logs = (() => {
    if (!activityQuery.data || activityQuery.data.status !== 200) return [];
    const body = activityQuery.data.body;
    if (Array.isArray(body)) return body as ActivityLog[];
    if (
      body &&
      typeof body === "object" &&
      "logs" in body &&
      Array.isArray((body as { logs: unknown }).logs)
    ) {
      return (body as { logs: ActivityLog[] }).logs;
    }
    return [];
  })() as ActivityLog[];
  const users = useUsersByIds(logs.map((log) => log.userId)).data;

  if (activityQuery.isError) {
    return (
      <ErrorState
        title={t("users.loadFailed")}
        description={t("users.loadFailedHint")}
        onRetry={() => void activityQuery.refetch()}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        <UsersCommandMetrics shown={users.length} />
        <ActivityLogs logs={logs} users={users} />
        <PinnedWidgets category="users" />
      </div>
    </ErrorBoundary>
  );
}
