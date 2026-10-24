import { useCallback, useState } from "react";
import {
  buildTenantExportFilename,
  type BackgroundJobRecord,
  type ExportColumn,
} from "@mms/shared";
import { useOptionalTenant } from "@/lib/contexts/TenantContext";
import { startServerModuleCsvExport } from "@/lib/backgroundJobs/startServerModuleCsvExport";
import { downloadBackgroundJobArtifact } from "@/lib/backgroundJobs/backgroundJobApi";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { apiJson } from "@/lib/apiClient";
import { safeAudit } from "@/lib/safeAudit";

export interface UseGenericModuleExportOptions {
  path: string;
  filename: string;
  label?: string;
  auditPath?: string;
  columns?: ExportColumn[];
  query?: Record<string, unknown>;
  canExport?: boolean;
}

export function useGenericModuleExport({
  path,
  filename,
  label,
  auditPath,
  columns,
  query,
  canExport = true,
}: UseGenericModuleExportOptions) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const optionalTenant = useOptionalTenant();

  const effectiveTenantName =
    optionalTenant?.workspace?.madrasaName ??
    optionalTenant?.publicBranding?.madrasaName ??
    optionalTenant?.subdomain ??
    null;

  const resolvedFilename = buildTenantExportFilename(effectiveTenantName, filename);

  const handleExport = useCallback(async (): Promise<void> => {
    if (!canExport || isExporting) return;
    setIsExporting(true);
    try {
      const job: BackgroundJobRecord = await startServerModuleCsvExport({
        path,
        body: {
          filename: resolvedFilename,
          label: label ?? t("common.export"),
          columns: columns ? columns.map((c) => ({ id: c.id, label: c.label })) : undefined,
          query,
        },
      });

      if (job.hasDownload && job.status === "completed") {
        await downloadBackgroundJobArtifact(job.id, resolvedFilename);
      }

      if (auditPath) {
        safeAudit(
          apiJson(auditPath, {
            method: "POST",
            body: JSON.stringify({
              count: job.progress?.total ?? job.progress?.current ?? 0,
              scope: "all",
            }),
          }),
          "module.export_audit",
        );
      }

      notify.success(t("common.export"));
    } catch (err) {
      notify.error(t("common.export"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsExporting(false);
    }
  }, [canExport, isExporting, path, resolvedFilename, label, t, columns, query, auditPath]);

  return {
    handleExport,
    isExporting,
  };
}
