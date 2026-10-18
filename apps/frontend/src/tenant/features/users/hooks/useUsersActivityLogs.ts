import type { SystemUser } from "@mms/shared";
import {
  extractActivityLogs,
  useActivityLogs,
  useUsersByIds,
} from "@/tenant/features/users/hooks/useUsersApi";

export interface UseUsersActivityLogsOptions {
  enabled: boolean;
}

export function useUsersActivityLogs({ enabled }: UseUsersActivityLogsOptions) {
  const logsResult = useActivityLogs({ enabled });
  const logs = extractActivityLogs(logsResult.data);
  const activityUsersResult = useUsersByIds(
    logs.map((log) => log.userId),
    { enabled },
  );
  const activityUsers = (activityUsersResult.data ?? []) as SystemUser[];
  const logsLoadFailed = logsResult.isError;
  const isLogsLoading = logsResult.isLoading || activityUsersResult.isLoading;

  const refetchLogs = () => {
    void logsResult.refetch();
  };

  return {
    logs,
    activityUsers,
    logsLoadFailed,
    isLogsLoading,
    refetchLogs,
  };
}
