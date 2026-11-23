/** Persisted recent workspace jumps for Cmd+K and the header switcher. */

import { createRecentStore } from "@/lib/createRecentStore";

export const RECENT_WORKSPACES_STORAGE_KEY = "mms_platform_recent_workspaces";
export const MAX_RECENT_WORKSPACES = 5;

export interface RecentWorkspaceRecord {
  subdomain: string;
  madrasaName: string;
}

function isRecentWorkspaceRecord(value: unknown): value is RecentWorkspaceRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RecentWorkspaceRecord).subdomain === "string" &&
    typeof (value as RecentWorkspaceRecord).madrasaName === "string"
  );
}

const recentWorkspaceStore = createRecentStore(
  RECENT_WORKSPACES_STORAGE_KEY,
  MAX_RECENT_WORKSPACES,
  isRecentWorkspaceRecord,
  (rec) => rec.subdomain,
);

export function loadRecentWorkspaces(): RecentWorkspaceRecord[] {
  return recentWorkspaceStore.load();
}

export function saveRecentWorkspace(rec: RecentWorkspaceRecord): RecentWorkspaceRecord[] {
  return recentWorkspaceStore.push(rec);
}
