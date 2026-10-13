import type React from "react";
import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WarningCallout } from "@/components/app/WarningCallout";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { ChangeEvent, RefObject } from "react";

export { AppleContactsPreviewList } from "@/tenant/features/contacts/components/sync/AppleContactsPreviewList";

export interface AppleContactsExportGuideProps {
  t: TranslationFunction;
}

export function AppleContactsExportGuide({ t }: AppleContactsExportGuideProps): React.JSX.Element {
  return (
    <div className="rounded-lg bg-muted/30 border border-border p-3 text-xs text-muted-foreground space-y-1">
      <p className="font-semibold text-foreground">{t("contacts.sync.appleExportTitle")}</p>
      <ol className="list-decimal list-inside space-y-0.5">
        <li>{t("contacts.sync.appleExportStep1")}</li>
        <li>{t("contacts.sync.appleExportStep2")}</li>
        <li>{t("contacts.sync.appleExportStep3")}</li>
        <li>{t("contacts.sync.appleExportStep4")}</li>
      </ol>
    </div>
  );
}

export interface AppleContactsImportResultProps {
  result: { imported: number; skipped: number };
  t: TranslationFunction;
}

export function AppleContactsImportResult({
  result,
  t,
}: AppleContactsImportResultProps): React.JSX.Element {
  return (
    <WarningCallout
      icon={CheckCircle2}
      tone="success"
      density="compact"
      title={t("contacts.sync.importComplete")}
      description={
        <>
          {t("contacts.sync.importedCount", { count: result.imported })}
          {result.skipped > 0
            ? ` · ${t("contacts.sync.skippedCount", { count: result.skipped })}`
            : ""}
        </>
      }
    />
  );
}

export interface AppleContactsExportBarProps {
  contactCount: number;
  exporting?: boolean;
  onExport: () => void;
  t: TranslationFunction;
}

export function AppleContactsExportBar({
  contactCount,
  exporting,
  onExport,
  t,
}: AppleContactsExportBarProps): React.JSX.Element {
  return (
    <div className="border-t border-border pt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-xs text-muted-foreground">
        {t("contacts.sync.exportAppleHint")}
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={onExport}
        disabled={contactCount === 0 || Boolean(exporting)}
        aria-busy={exporting}
        className="flex w-full sm:w-auto shrink-0 items-center gap-1.5 px-3.5 min-h-11 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors bg-card shadow-none"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{t("contacts.sync.exportVcf", { count: contactCount })}</span>
      </Button>
    </div>
  );
}

export interface AppleContactsFileInputProps {
  fileRef: RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  t: TranslationFunction;
  /** Distinct DOM id per host (panel vs import dialog) to avoid duplicate ids. */
  inputId?: string;
  accept?: string;
}

export function AppleContactsFileInput({
  fileRef,
  onChange,
  t,
  inputId = "contacts-vcf-import-file-input",
  accept = ".vcf,text/vcard,.csv,text/csv",
}: AppleContactsFileInputProps): React.JSX.Element {
  return (
    <input
      id={inputId}
      name="contactsVcfFile"
      ref={fileRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={onChange}
      aria-label={t("contacts.sync.uploadVcf")}
    />
  );
}
