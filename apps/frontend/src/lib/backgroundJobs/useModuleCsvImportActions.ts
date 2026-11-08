import { useCallback, useMemo, useState } from "react";
import {
  parseCsvRows,
  mapCsvGridToObjects,
  generateCsvTemplate,
  type CsvImportFieldMapping,
  type CsvTemplateColumn,
  type BackgroundJobRecord,
  type ModuleTransferSchema,
} from "@mms/shared";
import { triggerFileDownload } from "@/lib/download";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { startServerModuleCsvImport } from "@/lib/backgroundJobs/startServerModuleCsvImport";

export interface ModuleCsvImportProgress {
  current: number;
  total: number;
}

/** Custom submitter for modules whose import route expects a body other than `{ rows }`. */
export type ModuleCsvImportSubmitRows<TRow = Record<string, unknown>> = (
  rows: TRow[],
  onProgress: (progress: ModuleCsvImportProgress) => void,
) => Promise<BackgroundJobRecord>;

export interface UseModuleCsvImportActionsOptions<TRow = Record<string, unknown>> {
  apiPath: string;
  moduleId?: string;
  schema?: ModuleTransferSchema<TRow>;
  mappings?: CsvImportFieldMapping<TRow>[];
  templateColumns?: CsvTemplateColumn[];
  defaultLabel?: string;
  submitRows?: ModuleCsvImportSubmitRows<TRow>;
  maxRows?: number;
  onSuccess?: () => void;
}

export function useModuleCsvImportActions<TRow = Record<string, unknown>>(
  options: UseModuleCsvImportActionsOptions<TRow>,
) {
  const { t } = useTranslation();
  const { apiPath, schema, submitRows, onSuccess, maxRows } = options;
  const effectiveModuleId = schema?.moduleId ?? options.moduleId ?? "module";
  const effectiveMappings = useMemo(
    () => schema?.importMappings ?? options.mappings ?? [],
    [schema?.importMappings, options.mappings],
  );
  const effectiveTemplateColumns = useMemo(
    () => schema?.templateColumns ?? options.templateColumns ?? [],
    [schema?.templateColumns, options.templateColumns],
  );
  const defaultLabel =
    options.defaultLabel ||
    (schema ? `Importing ${schema.entityNounPlural}` : `Importing ${effectiveModuleId}`);
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<TRow[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [completedJob, setCompletedJob] = useState<BackgroundJobRecord | null>(null);

  const resetState = useCallback(() => {
    setFileName("");
    setParsedRows([]);
    setMissingHeaders([]);
    setRowErrors([]);
    setIsImporting(false);
    setProgress(null);
    setCompletedJob(null);
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const csvContent = schema
      ? schema.generateTemplate()
      : generateCsvTemplate(effectiveTemplateColumns);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const filename = schema?.defaultFilename ?? `${effectiveModuleId}_import_template.csv`;
    triggerFileDownload(blob, filename);
  }, [effectiveModuleId, effectiveTemplateColumns, schema]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      resetState();
      setFileName(file.name);
      // Guard before reading: a multi-MB/100k-row CSV is parsed synchronously on the main
      // thread and would freeze the tab, only to be rejected by the 500-row server cap.
      const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
      const effectiveMaxRows = maxRows ?? (submitRows ? 10_000 : 500);
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        setRowErrors([{ row: 0, error: t("module.import.fileTooLarge") }]);
        return;
      }
      try {
        const text = await file.text();
        const result = schema
          ? schema.fromImportCsv(text)
          : mapCsvGridToObjects<TRow>(parseCsvRows(text), effectiveMappings);

        setMissingHeaders(result.missingHeaders);
        if (result.rows.length > effectiveMaxRows) {
          setRowErrors([{ row: 0, error: t("module.import.tooManyRows") }]);
          setParsedRows([]);
          return;
        }
        setRowErrors(result.rowErrors);
        setParsedRows(result.rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setRowErrors([{ row: 0, error: `${t("module.import.failed")}: ${msg}` }]);
      }
    },
    [effectiveMappings, maxRows, resetState, schema, submitRows, t],
  );

  const handleStartImport = useCallback(async () => {
    if (parsedRows.length === 0 || isImporting) return;
    setIsImporting(true);
    setProgress({ current: 0, total: parsedRows.length });

    try {
      const job = submitRows
        ? await submitRows(parsedRows, (nextProgress) => setProgress(nextProgress))
        : await startServerModuleCsvImport({
            path: apiPath,
            body: {
              rows: parsedRows,
              label: defaultLabel,
            },
            onProgress: (updatedJob) => {
              if (updatedJob.progress) {
                setProgress(updatedJob.progress);
              }
            },
          });

      // The completed panel owns the outcome feedback (label + counts); a success
      // toast would duplicate it now that the dialog stays open (S-01).
      setCompletedJob(job);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify.error(t("module.import.failed"), msg ? { description: msg } : undefined);
    } finally {
      setIsImporting(false);
    }
  }, [apiPath, defaultLabel, isImporting, onSuccess, parsedRows, submitRows, t]);

  return {
    isOpen,
    setIsOpen,
    fileName,
    parsedRows,
    missingHeaders,
    rowErrors,
    isImporting,
    progress,
    completedJob,
    resetState,
    handleFileSelect,
    handleDownloadTemplate,
    handleStartImport,
  };
}
