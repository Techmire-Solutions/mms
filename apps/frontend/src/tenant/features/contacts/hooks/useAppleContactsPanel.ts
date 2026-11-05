import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { type Contact, buildTenantExportFilename } from "@mms/shared";
import { useOptionalTenant } from "@/lib/contexts/TenantContext";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { resolvePhoneLabel, resolveEmailLabel } from "@/lib/contacts/contactI18n";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { reportClientError } from "@/lib/clientErrorReporting";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import { downloadBackgroundJobArtifact } from "@/lib/backgroundJobs/backgroundJobApi";
import { startServerContactsVcfExport } from "@/lib/backgroundJobs/startServerContactsBackgroundJobs";
import { useContactsMetrics } from "@/tenant/features/contacts/hooks/useContacts";
import { useContactMutations } from "@/tenant/features/contacts/hooks/useContactMutations";
import {
  buildAppleImportIdentityCandidates,
  dedupeAppleImportPreview,
  filterAppleImportFreshContacts,
  matchAppleImportIdentity,
} from "@/tenant/features/contacts/hooks/appleContactsIdentity";
import { readAndParseAppleContactsFile } from "@/tenant/features/contacts/hooks/appleContactsFileParser";

export function useAppleContactsPanel({
  onImport,
  canWrite,
}: {
  onImport: (
    contacts: Contact[],
    options?: { onProgress?: (progress: { imported: number; total: number }) => void },
  ) =>
    | void
    | { succeeded: number; failed: number }
    | Promise<void | { succeeded: number; failed: number }>;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const { phoneLabels, emailLabels, defaultPhoneCountryCode } = useContactConfig();
  const { matchContactIdentity } = useContactMutations();
  const mobileLabel = resolvePhoneLabel(undefined, phoneLabels, t);
  const personalLabel = resolveEmailLabel(undefined, emailLabels, t);
  const { data: metrics } = useContactsMetrics({ enabled: true });
  const exportCount = metrics?.total ?? 0;
  const [previewList, setPreviewList] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  /** A selected file is being read/parsed on the main thread. */
  const [isParsing, setIsParsing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ imported: number; total: number } | null>(
    null,
  );
  /**
   * Busy flag for the whole import, not just the identity match: the queued batch job keeps
   * running after the match resolves, and the CTA must stay disabled until it finishes or a
   * second click re-imports the same list.
   */
  const importing = matchContactIdentity.isPending || isWriting || isParsing;
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File): void => {
    setFileName(file.name);
    setFileError(null);
    setIsParsing(true);
    readAndParseAppleContactsFile(
      file,
      { mobileLabel, personalLabel, defaultPhoneCountryCode },
      ({ parsed, error, limit }) => {
        setIsParsing(false);
        if (limit) {
          const reason =
            limit.kind === "file_too_large"
              ? t("contacts.sync.fileTooLarge", { limit: limit.limitMb })
              : t("contacts.sync.tooManyContacts", {
                  count: limit.count,
                  limit: limit.limit,
                });
          setPreviewList([]);
          setResult(null);
          setFileError(reason);
          notify.error(reason);
          return;
        }
        if (parsed.length === 0) {
          const reason = error || t("contacts.sync.emptyOrInvalidFile", { filename: file.name });
          setFileError(reason);
          notify.error(reason);
        }
        setPreviewList(dedupeAppleImportPreview(parsed));
        setResult(null);
      },
    );
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    processFile(file);
  };

  const handleDroppedFiles = (files: FileList | null): void => {
    if (!canWrite) return;
    const file = files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async (): Promise<void> => {
    if (!canWrite || importing) return;
    setIsWriting(true);
    setImportProgress({ imported: 0, total: previewList.length });
    try {
      const candidates = buildAppleImportIdentityCandidates(previewList, defaultPhoneCountryCode);
      // Identity lists are capped per request server-side (2,000); chunk them so a
      // full 5,000-contact vCard does not fail the whole import on a 400.
      const existing = await matchAppleImportIdentity(candidates, (body) =>
        matchContactIdentity.mutateAsync(body),
      );
      const fresh = filterAppleImportFreshContacts(previewList, existing);
      const importResult = await onImport(fresh, { onProgress: setImportProgress });
      const actuallyImported =
        importResult && typeof importResult === "object" && "succeeded" in importResult
          ? importResult.succeeded
          : fresh.length;
      const importFailed =
        importResult && typeof importResult === "object" && "failed" in importResult
          ? importResult.failed
          : 0;

      if (actuallyImported > 0 || previewList.length === 0) {
        setResult({
          imported: actuallyImported,
          skipped: previewList.length - fresh.length + importFailed,
        });
        setPreviewList([]);
      }
    } catch (err) {
      // Surface the API/validation detail (e.g. a duplicate phone) instead of a bare failure toast.
      const validationMessage = getApiValidationMessage(err);
      notify.error(
        t("contacts.saveFailed"),
        validationMessage ? { description: validationMessage } : undefined,
      );
      reportClientError(err, { scope: "contacts.import_identity_match" });
    } finally {
      setIsWriting(false);
      setImportProgress(null);
    }
  };

  const optionalTenant = useOptionalTenant();
  const effectiveTenantName =
    optionalTenant?.workspace?.madrasaName ??
    optionalTenant?.publicBranding?.madrasaName ??
    optionalTenant?.subdomain ??
    null;

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const baseFilename = t("contacts.sync.vcfFileName");
      const filename = buildTenantExportFilename(effectiveTenantName, baseFilename);
      const job = await startServerContactsVcfExport({
        filename,
        label: t("contacts.jobs.exportLabelServer"),
      });
      if (job.hasDownload && job.status === "completed") {
        await downloadBackgroundJobArtifact(job.id, filename);
      }
      notify.success(t("contacts.exportSuccess"));
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      notify.error(t("contacts.saveFailed"));
    } finally {
      setExporting(false);
    }
  };

  const clearPreview = (): void => {
    setPreviewList([]);
    setFileName(null);
    setFileError(null);
  };

  const chooseDifferentFile = (): void => {
    setPreviewList([]);
    setFileName(null);
    setFileError(null);
    fileRef.current?.click();
  };

  const openFilePicker = (): void => {
    if (canWrite) fileRef.current?.click();
  };

  return {
    previewList,
    fileName,
    fileError,
    importing,
    isParsing,
    importProgress,
    exporting,
    exportCount,
    result,
    isDragging,
    setIsDragging,
    fileRef: fileRef as RefObject<HTMLInputElement | null>,
    handleFile,
    handleDroppedFiles,
    handleImport,
    handleExport,
    clearPreview,
    chooseDifferentFile,
    openFilePicker,
  };
}
