import { todayISOInTimeZone } from "@mms/shared";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";

/**
 * The workspace's current calendar day (`YYYY-MM-DD`).
 *
 * Forms that seed effective dates or "today" must agree with the server's
 * workspace-timezone gates; `todayISO()` uses the device clock and can name
 * yesterday while the workspace has already crossed midnight.
 */
export function useWorkspaceToday(): string {
  const { timezone } = useGlobalSettings();
  return todayISOInTimeZone(timezone);
}
