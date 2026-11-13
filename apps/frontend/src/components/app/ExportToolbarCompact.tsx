import React from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { useRovingToolbar } from "@/hooks/useRovingToolbar";

export interface ExportToolbarCompactProps {
  compactFormat: "excel" | "pdf";
  onCompactFormatChange: (format: "excel" | "pdf") => void;
  onExport: () => void;
  /** Hide the PDF format option (accounting statements use the server PDF). */
  hidePdf?: boolean;
}

export function ExportToolbarCompact({
  compactFormat,
  onCompactFormatChange,
  onExport,
  hidePdf = false,
}: ExportToolbarCompactProps): React.JSX.Element {
  const { t } = useTranslation();
  const toolbarRef = useRovingToolbar<HTMLDivElement>();

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-1.5 flex-wrap"
      role="toolbar"
      aria-label={t("reports.export.tools")}
    >
      <div className="flex min-h-11 rounded-lg border border-border text-xs font-bold">
        <Button
          type="button"
          data-toolbar-item
          aria-pressed={compactFormat === "excel"}
          onClick={() => onCompactFormatChange("excel")}
          className={`flex min-h-11 items-center gap-1 h-auto px-2.5 py-2 rounded-s-lg shadow-none font-bold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${compactFormat === "excel" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-card text-muted-foreground hover:bg-muted"}`}
        >
          <FileSpreadsheet className="w-3 h-3" aria-hidden="true" />
          {t("reports.export.excel")}
        </Button>
        {hidePdf ? null : (
          <Button
            type="button"
            data-toolbar-item
            aria-pressed={compactFormat === "pdf"}
            onClick={() => onCompactFormatChange("pdf")}
            className={`flex min-h-11 items-center gap-1 h-auto px-2.5 py-2 rounded-e-lg shadow-none border-s border-border font-bold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${compactFormat === "pdf" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-card text-muted-foreground hover:bg-muted"}`}
          >
            <FileText className="w-3 h-3" aria-hidden="true" />
            {t("reports.export.pdf")}
          </Button>
        )}
      </div>
      <Button
        type="button"
        aria-label={t("reports.export.exportAs", {
          format: compactFormat === "excel" ? t("reports.export.excel") : t("reports.export.pdf"),
        })}
        onClick={onExport}
        data-toolbar-item
        className="flex min-h-11 items-center gap-1.5 h-auto px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Download className="w-3 h-3" aria-hidden="true" />
        {t("reports.export.download")}
      </Button>
    </div>
  );
}
