import type { PlatformWorkspaceRow } from "@mms/shared";
import { triggerFileDownload } from "@/lib/download";

export interface PlatformReportsSummaryStats {
  totalWorkspaces: number;
  activeWorkspaces: number;
  disabledWorkspaces: number;
  activeRate: number;
  verifyRequiredCount: number;
  verifyOptionalCount: number;
}

export function exportPlatformReportsCsv(
  workspaces: PlatformWorkspaceRow[] | undefined,
  stats: PlatformReportsSummaryStats,
): void {
  const lines: string[] = [];

  lines.push("--- PLATFORM WORKSPACES SUMMARY REPORT ---");
  lines.push(`Generated At,${new Date().toISOString()}`);
  lines.push(`Total Workspaces,${stats.totalWorkspaces}`);
  lines.push(`Active Workspaces,${stats.activeWorkspaces}`);
  lines.push(`Inactive Workspaces,${stats.disabledWorkspaces}`);
  lines.push(`Activation Rate,${stats.activeRate}%`);
  lines.push(`Email Verification Required,${stats.verifyRequiredCount}`);
  lines.push(`Email Verification Optional,${stats.verifyOptionalCount}`);
  lines.push("");

  lines.push("Subdomain,Madrasa Name,Status,Email Verification,Admin Email,Created At");
  if (workspaces && workspaces.length > 0) {
    for (const w of workspaces) {
      const status = w.enabled ? "Active" : "Disabled";
      const verify = w.requireEmailVerification ? "Required" : "Optional";
      lines.push(
        [
          `"${w.subdomain.replace(/"/g, '""')}"`,
          `"${w.madrasaName.replace(/"/g, '""')}"`,
          `"${status}"`,
          `"${verify}"`,
          `"${(w.adminEmail || "").replace(/"/g, '""')}"`,
          `"${w.createdAt || ""}"`,
        ].join(","),
      );
    }
  }

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerFileDownload(blob, `platform-reports-${new Date().toISOString().slice(0, 10)}.csv`);
}
