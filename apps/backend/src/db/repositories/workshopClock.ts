import { todayInTimeZone } from "../../lib/dbDate.js";
import { findWorkspaceTimezone } from "./workspaceSettingsRepository.js";

/**
 * The workspace business day (`YYYY-MM-DD`) used by every lifecycle rule.
 *
 * Resolved through `activeDb()`, so when a caller already owns a transaction this read joins it and
 * the deadline/phase decision is made against the same snapshot as the write. Business dates belong
 * to the workspace's timezone, never to the server's or the browser's.
 */
export async function workshopToday(tenant: string): Promise<string> {
  return todayInTimeZone(await findWorkspaceTimezone(tenant));
}
