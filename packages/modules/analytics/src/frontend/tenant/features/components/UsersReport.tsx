import React, { useMemo } from "react";
import type { ActivityLog } from "@mms/contracts";
import { ErrorBoundary } from "@mms/fe-core/components/ErrorBoundary";
import { UsersCommandMetrics } from "../../host/moduleReportAdapters";
import { ActivityLogs } from "../../host/moduleReportAdapters";
import { useActivityLogs, useUsersByIds } from "../../host/collections";
import { ErrorState } from "@mms/fe-core/components/ErrorState";
import { useTranslation } from "@mms/fe-core/i18n";

import PinnedWidgets from "./PinnedWidgets";

export default function UsersReport(): React.JSX.Element {
  const { t } = useTranslation();
  const activityQuery = useActivityLogs();

  const logs = useMemo(() => {
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
  }, [activityQuery.data]);

  const userIds = useMemo(() => logs.map((log: any) => log.userId), [logs]);
  const users = useUsersByIds(userIds).data;

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
