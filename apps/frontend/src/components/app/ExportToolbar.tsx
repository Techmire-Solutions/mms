import React, { useState } from "react";
import { FileSpreadsheet, FileText, Printer, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { ExportPdfSettingsPopover } from "@/components/ui/ExportPdfSettingsPopover";
import { exportExcel, exportPdf, type ExportColumn } from "@/components/ui/exportToolbarUtils";
import { ExportToolbarCompact } from "@/components/ui/ExportToolbarCompact";

export type { ExportColumn } from "@/components/ui/exportToolbarUtils";

export interface ExportToolbarProps {
  title: string;
  columns?: ExportColumn[];
  rows?: Record<string, unknown>[];
  filename?: string;
  moduleId?: string;
  exportLabel?: string;
  onPrint?: () => void;
  data?: unknown[];
  headers?: string[];
  variant?: "default" | "compact";
  /** When set, Excel/PDF resolve rows at click time (full filtered export). */
  resolveRows?: () => Promise<Record<string, unknown>[]>;
}

export function ExportToolbar({
  title,
  columns,
  rows,
  filename,
  moduleId,
  exportLabel,
  onPrint,
  data,
  headers,
  variant,
  resolveRows,
}: ExportToolbarProps): React.JSX.Element {
  const { t } = useTranslation();
  const [orientation, setOrientation] = useState<"p" | "l">("p");
  const [formatSize, setFormatSize] = useState<string>("a4");
  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [compactFormat, setCompactFormat] = useState<"excel" | "pdf">("excel");
  const [exporting, setExporting] = useState(false);

  const resolvedVariant = variant || (rows || data || resolveRows ? "default" : "compact");
  const resolvedFilename = (() => filename || title.toLowerCase().replace(/\s+/g, "_"))();

  const [titlePrefix, titleSuffix] = (() => {
    const parts = t("reports.export.title", { name: "||TITLE||" }).split("||TITLE||");
    return [parts[0] || "", parts[1] || ""];
  })();

  const finalRows = (() => rows || (data as Record<string, unknown>[]) || [])();
  const finalColumns = (() =>
    columns || (headers ? headers.map((h) => ({ header: h, key: h })) : []))();
  const canExport = Boolean(resolveRows) || finalRows.length > 0;

  const handlePrint = (): void => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  const resolveExportRows = async (): Promise<Record<string, unknown>[]> => {
    if (resolveRows) return resolveRows();
    return finalRows;
  };

  const handleExcelExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const exportRows = await resolveExportRows();
      await exportExcel({
        title,
        columns: finalColumns,
        rows: exportRows,
        filename: resolvedFilename,
        moduleId,
        exportLabel,
        sourceColumns: columns,
        sourceHeaders: headers,
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePdfExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const exportRows = await resolveExportRows();
      await exportPdf({
        title,
        rows: exportRows,
        filename: resolvedFilename,
        orientation,
        formatSize,
        variant: resolvedVariant,
        sourceColumns: columns,
        sourceHeaders: headers,
      });
    } finally {
      setExporting(false);
    }
  };

  if (resolvedVariant === "compact") {
    return (
      <ExportToolbarCompact
        compactFormat={compactFormat}
        onCompactFormatChange={setCompactFormat}
        onExport={() => {
          void (compactFormat === "excel" ? handleExcelExport() : handlePdfExport());
        }}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap py-2 text-start relative">
      <p className="text-xs text-muted-foreground">
        {titlePrefix}
        <span className="font-semibold text-foreground">{title}</span>
        {titleSuffix}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <ExportPdfSettingsPopover
          open={showPdfSettings}
          orientation={orientation}
          onOrientationChange={setOrientation}
          pageSize={formatSize}
          onPageSizeChange={setFormatSize}
          placement="top"
          idPrefix="export"
        />

        <Button
          onClick={handlePrint}
          variant="outline"
          className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          type="button"
        >
          <Printer className="w-3.5 h-3.5" aria-hidden="true" />
          {t("reports.export.print")}
        </Button>
        <Button
          onClick={() => {
            void handleExcelExport();
          }}
          disabled={!canExport || exporting}
          variant="outline"
          className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          type="button"
          aria-busy={exporting}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-success" aria-hidden="true" />
          {t("reports.export.excel")}
        </Button>

        <div className="flex min-h-11 overflow-x-auto rounded-lg border border-border bg-card">
          <Button
            onClick={() => {
              void handlePdfExport();
            }}
            disabled={!canExport || exporting}
            variant="ghost"
            className="flex min-h-11 items-center gap-1.5 px-3 py-2 border-e border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 rounded-none"
            type="button"
            aria-busy={exporting}
          >
            <FileText className="w-3.5 h-3.5 text-destructive" aria-hidden="true" />
            {t("reports.export.pdf")}
          </Button>
          <Button
            onClick={() => setShowPdfSettings(!showPdfSettings)}
            variant="ghost"
            className={`min-h-11 min-w-11 px-2 py-2 hover:bg-muted transition-colors rounded-none ${showPdfSettings ? "text-primary bg-primary/5" : "text-muted-foreground"}`}
            title={t("reports.export.settings")}
            type="button"
          >
            <SettingsIcon className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
