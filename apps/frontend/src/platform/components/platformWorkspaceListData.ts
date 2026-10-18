import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { triggerFileDownload } from "@/lib/download";

/** Sortable workspace list columns (URL `sort` param). */
export type WorkspaceSortField = "name" | "subdomain" | "createdAt" | "status";
/** Sort direction (URL `dir` param). */
export type WorkspaceSortDirection = "asc" | "desc";

/** Search (name/subdomain) + status filter over the workspace rows. */
export function filterWorkspaces(
  items: PlatformWorkspaceRowData[],
  search: string,
  statusFilter: "all" | "active" | "inactive",
): PlatformWorkspaceRowData[] {
  return items.filter((workspace) => {
    const matchesSearch =
      workspace.madrasaName.toLowerCase().includes(search.toLowerCase()) ||
      workspace.subdomain.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && workspace.enabled) ||
      (statusFilter === "inactive" && !workspace.enabled);

    return matchesSearch && matchesStatus;
  });
}

/** Locale-aware sort with createdAt by timestamp and active-status first (URL `sort`/`dir` params). */
export function sortWorkspaces(
  items: PlatformWorkspaceRowData[],
  sortField: WorkspaceSortField,
  sortDirection: WorkspaceSortDirection,
): PlatformWorkspaceRowData[] {
  return items.toSorted((a, b) => {
    let comparison = 0;
    if (sortField === "name") {
      comparison = a.madrasaName.localeCompare(b.madrasaName);
    } else if (sortField === "subdomain") {
      comparison = a.subdomain.localeCompare(b.subdomain);
    } else if (sortField === "createdAt") {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortField === "status") {
      comparison = Number(b.enabled) - Number(a.enabled);
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

/** Download the (filtered, sorted) workspace rows as a CSV file with a dated filename. */
export function downloadWorkspacesCsv(sortedWorkspaces: PlatformWorkspaceRowData[]): void {
  if (sortedWorkspaces.length === 0) return;
  const headers = ["Subdomain", "Madrasa Name", "Status", "Email Verification", "Created At"];
  const rows = sortedWorkspaces.map((workspace) => [
    workspace.subdomain,
    workspace.madrasaName,
    workspace.enabled ? "Active" : "Disabled",
    workspace.requireEmailVerification ? "Required" : "Optional",
    workspace.createdAt,
  ]);
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(blob, `platform-workspaces-${new Date().toISOString().slice(0, 10)}.csv`);
}
