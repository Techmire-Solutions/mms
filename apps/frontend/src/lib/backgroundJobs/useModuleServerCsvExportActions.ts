import { useCallback, useMemo, useRef, useState } from "react";
import {
  buildTenantExportFilename,
  isSystemMetadataKey,
  type BackgroundJobRecord,
} from "@mms/shared";
import { useOptionalTenant } from "@/lib/contexts/TenantContext";
import { downloadBackgroundJobArtifact } from "@/lib/backgroundJobs/backgroundJobApi";
import {
  csvExportAttemptSignature,
  nextCsvExportAttempt,
  type CsvExportAttempt,
} from "@/lib/backgroundJobs/csvExportAttemptKey";
import { BackgroundJobTimeoutError } from "@/lib/backgroundJobs/pollBackgroundJob";
import { notify } from "@/lib/notify";
import { safeAudit } from "@/lib/safeAudit";

export type ModuleCsvExportAuditScope = "all" | "filtered" | "selection";

export interface ModuleServerCsvExportColumn {
  id: string;
  label: string;
}

export interface UseModuleServerCsvExportActionsOptions<
  TColumn extends ModuleServerCsvExportColumn = ModuleServerCsvExportColumn,
  TQuery = Record<string, unknown>,
> {
  canExport: boolean;
  /** When true (trash / archived view), export handlers no-op. */
  trashMode: boolean;
  selectedIds: Array<string | number>;
  columns: TColumn[];
  filename: string;
  /** Job label — also the copy shown when a queue-wait exceeds the poll budget. */
  label: string;
  successMessage: string;
  auditScope: string;
  filteredErrorScope: string;
  selectionErrorScope: string;
  /**
   * Whether the directory has an applied filter. Drives the audit scope of a
   * whole-directory export: `filtered` when narrowed, `all` when unfiltered.
   */
  hasActiveFilters?: boolean;
  buildFilteredQuery: () => TQuery;
  startExport: (options: {
    query: TQuery;
    columns: ModuleServerCsvExportColumn[];
    filename: string;
    label: string;
    ids?: Array<string | number>;
    idempotencyKey?: string;
  }) => Promise<BackgroundJobRecord>;
  logExportAudit: {
    mutateAsync: (payload: { count: number; scope: ModuleCsvExportAuditScope }) => Promise<unknown>;
  };
  onError: (err: unknown, scope: string) => void;
  tenantName?: string;
}

const sanitizeColumns = (cols: ModuleServerCsvExportColumn[]) =>
  cols
    .filter((c) => !isSystemMetadataKey(c.id) && !isSystemMetadataKey(c.label))
    .map((c) => ({ id: c.id, label: c.label }));

/**
 * Shared filtered + selection server CSV export flow (Contacts / Students / Teachers / Enrollments).
 */
export function useModuleServerCsvExportActions<
  TColumn extends ModuleServerCsvExportColumn = ModuleServerCsvExportColumn,
  TQuery = Record<string, unknown>,
>(options: UseModuleServerCsvExportActionsOptions<TColumn, TQuery>) {
  const {
    canExport,
    trashMode,
    selectedIds,
    columns,
    filename,
    label,
    successMessage,
    auditScope,
    filteredErrorScope,
    selectionErrorScope,
    hasActiveFilters = false,
    buildFilteredQuery,
    startExport,
    logExportAudit,
    onError,
    tenantName,
  } = options;
  const [isExporting, setIsExporting] = useState(false);
  const attemptRef = useRef<CsvExportAttempt | null>(null);

  const optionalTenant = useOptionalTenant();
  const effectiveTenantName =
    tenantName ??
    optionalTenant?.workspace?.madrasaName ??
    optionalTenant?.publicBranding?.madrasaName ??
    optionalTenant?.subdomain ??
    null;
  const resolvedFilename = useMemo(
    () => buildTenantExportFilename(effectiveTenantName, filename),
    [effectiveTenantName, filename],
  );

  const runExport = useCallback(
    async (
      scope: ModuleCsvExportAuditScope,
      errorScope: string,
      buildBody: (attemptKey: string) => Parameters<typeof startExport>[0],
      fallbackCount: number,
      signaturePayload: unknown,
    ): Promise<void> => {
      const signature = csvExportAttemptSignature(scope, signaturePayload);
      const attempt = nextCsvExportAttempt(attemptRef.current, signature);
      attemptRef.current = attempt;

      try {
        const job = await startExport(buildBody(attempt.key));
        attemptRef.current = null;
        if (job.hasDownload && job.status === "completed") {
          await downloadBackgroundJobArtifact(job.id, resolvedFilename);
        }
        notify.success(successMessage);
        safeAudit(
          logExportAudit.mutateAsync({
            count: job.progress?.total ?? job.progress?.current ?? fallbackCount,
            scope,
          }),
          auditScope,
        );
      } catch (err) {
        if (err instanceof BackgroundJobTimeoutError) {
          // Still running server-side: keep the attempt key so a retry dedupes onto it.
          notify.info(label);
          return;
        }
        // Definite failure — rotate the key so the retry is a new job, not the failed one.
        attemptRef.current = null;
        onError(err, errorScope);
      }
    },
    [auditScope, resolvedFilename, label, logExportAudit, onError, startExport, successMessage],
  );

  const handleExportCSV = async (): Promise<void> => {
    if (!canExport || trashMode || isExporting) return;
    const query = buildFilteredQuery();
    setIsExporting(true);
    try {
      await runExport(
        hasActiveFilters ? "filtered" : "all",
        filteredErrorScope,
        (idempotencyKey) => ({
          query,
          columns: sanitizeColumns(columns),
          filename: resolvedFilename,
          label,
          idempotencyKey,
        }),
        0,
        query,
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExport = async (): Promise<void> => {
    if (!canExport || trashMode || isExporting) return;
    if (selectedIds.length === 0) return;
    setIsExporting(true);
    try {
      await runExport(
        "selection",
        selectionErrorScope,
        (idempotencyKey) => ({
          query: {} as TQuery,
          columns: sanitizeColumns(columns),
          filename: resolvedFilename,
          label,
          ids: selectedIds,
          idempotencyKey,
        }),
        selectedIds.length,
        selectedIds.map(String),
      );
    } finally {
      setIsExporting(false);
    }
  };

  return {
    handleExportCSV,
    handleBulkExport,
    isExporting,
  };
}
