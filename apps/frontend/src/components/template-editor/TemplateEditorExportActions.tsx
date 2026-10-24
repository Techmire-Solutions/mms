/**
 * @file TemplateEditorExportActions.tsx
 * @description Toolbar action buttons for printing, template JSON import/export, and
 * data export for the Typst renderer / Zoho invoices.
 */

import React, { useRef } from "react";
import { Download, Upload, FileJson2, FileCode2, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorExportActionsProps {
  onExportJson?: () => void;
  onImportJson?: (file: File) => void;
  onExportTypst?: () => void;
  onExportZoho?: () => void;
  onPrint?: () => void;
  isExporting?: boolean;
  disabled?: boolean;
  t: TranslationFunction;
}

const MAX_TEMPLATE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ACTION_BUTTON =
  "min-h-11 h-11 px-2.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted transition-colors shadow-none flex items-center gap-1.5";

export function TemplateEditorExportActions({
  onExportJson,
  onImportJson,
  onExportTypst,
  onExportZoho,
  onPrint,
  isExporting = false,
  disabled = false,
  t,
}: TemplateEditorExportActionsProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size <= MAX_TEMPLATE_FILE_SIZE && onImportJson) {
        onImportJson(file);
      } else if (file.size > MAX_TEMPLATE_FILE_SIZE) {
        window.alert(t("templateEditor.importFileTooLarge"));
      }
      e.target.value = "";
    }
  };

  const isDisabled = disabled || isExporting;

  return (
    <div
      role="group"
      aria-label={t("templateEditor.exportImport")}
      className="flex items-center gap-1.5 ms-2 flex-nowrap shrink-0 print:hidden"
    >
      <Button
        type="button"
        onClick={onPrint || (() => window.print())}
        disabled={isDisabled}
        variant="outline"
        className={ACTION_BUTTON}
        title={t("templateEditor.print")}
        aria-label={t("templateEditor.print")}
      >
        <Printer className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <span className="hidden sm:inline">{t("templateEditor.print")}</span>
      </Button>

      {onExportJson && (
        <Button
          type="button"
          onClick={onExportJson}
          disabled={isDisabled}
          variant="outline"
          className={ACTION_BUTTON}
          title={t("templateEditor.exportJson")}
          aria-label={t("templateEditor.exportJson")}
        >
          <Download className="w-4 h-4 text-success" aria-hidden="true" />
          <span className="hidden sm:inline">{t("templateEditor.templateFile")}</span>
        </Button>
      )}

      {onImportJson && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label={t("templateEditor.importJson")}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            variant="outline"
            className={ACTION_BUTTON}
            title={t("templateEditor.importJson")}
            aria-label={t("templateEditor.importJson")}
          >
            <Upload className="w-4 h-4 text-info" aria-hidden="true" />
            <span className="hidden sm:inline">{t("templateEditor.import")}</span>
          </Button>
        </>
      )}

      {onExportTypst && (
        <Button
          type="button"
          onClick={onExportTypst}
          disabled={isDisabled}
          variant="outline"
          className={ACTION_BUTTON}
          title={t("templateEditor.exportTypst")}
          aria-label={t("templateEditor.exportTypst")}
        >
          <FileCode2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          {/* Product name, taken from the catalog so locales may transliterate it. */}
          <span className="hidden sm:inline">{t("templateEditor.typst")}</span>
        </Button>
      )}

      {onExportZoho && (
        <Button
          type="button"
          onClick={onExportZoho}
          disabled={isDisabled}
          variant="outline"
          className={ACTION_BUTTON}
          title={t("templateEditor.exportZoho")}
          aria-label={t("templateEditor.exportZoho")}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" aria-hidden="true" />
          ) : (
            /*
             * Deliberately a download icon, not a cloud-upload icon: this button
             * writes a JSON file. Labelling it "sync" with an upload affordance
             * promised a live Zoho integration that does not exist in the backend.
             */
            <FileJson2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          )}
          {/* Product name, taken from the catalog so locales may transliterate it. */}
          <span className="hidden sm:inline">{t("templateEditor.zoho")}</span>
        </Button>
      )}
    </div>
  );
}
