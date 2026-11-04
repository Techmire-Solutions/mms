/**
 * @file workspaceDay.ts
 * @description The workspace business day (`YYYY-MM-DD`) in the workspace timezone.
 */
import { loadWorkspaceRow } from "../db/repositories/workspaceRepositoryCache.js";
import { todayInTimeZone } from "./dbDate.js";

/** Today's calendar day for `tenant`, using its configured IANA timezone. */
export async function workspaceTodayIso(tenant: string): Promise<string> {
  const subdomain = tenant.trim().toLowerCase();
  const workspace = await loadWorkspaceRow(subdomain);
  return todayInTimeZone(workspace?.timezone);
}
