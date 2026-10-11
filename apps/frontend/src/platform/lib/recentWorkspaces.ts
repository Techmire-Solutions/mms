/** Persisted recent workspace jumps for Cmd+K and the header switcher. */

export const RECENT_WORKSPACES_STORAGE_KEY = "mms_platform_recent_workspaces";
export const MAX_RECENT_WORKSPACES = 5;

export interface RecentWorkspaceRecord {
  subdomain: string;
  madrasaName: string;
}

export function loadRecentWorkspaces(): RecentWorkspaceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_WORKSPACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentWorkspaceRecord =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as RecentWorkspaceRecord).subdomain === "string" &&
          typeof (item as RecentWorkspaceRecord).madrasaName === "string",
      )
      .slice(0, MAX_RECENT_WORKSPACES);
  } catch {
    return [];
  }
}

export function saveRecentWorkspace(rec: RecentWorkspaceRecord): RecentWorkspaceRecord[] {
  const current = loadRecentWorkspaces().filter((w) => w.subdomain !== rec.subdomain);
  const updated = [rec, ...current].slice(0, MAX_RECENT_WORKSPACES);
  try {
    localStorage.setItem(RECENT_WORKSPACES_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota / private-mode write failures
  }
  return updated;
}
