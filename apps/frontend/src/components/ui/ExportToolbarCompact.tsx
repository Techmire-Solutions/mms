import React from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

export interface ExportToolbarCompactProps {
  compactFormat: "excel" | "pdf";
  onCompactFormatChange: (format: "excel" | "pdf") => void;
  onExport: () => void;
}

export function ExportToolbarCompact({
  compactFormat,
  onCompactFormatChange,
  onExport,
}: ExportToolbarCompactProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      role="toolbar"
      aria-label={t("reports.export.tools")}
    >
      <div className="flex min-h-11 overflow-x-auto rounded-lg border border-border text-xs font-bold">
        <Button
          type="button"
          aria-pressed={compactFormat === "excel"}
          onClick={() => onCompactFormatChange("excel")}
          className={`flex min-h-11 items-center gap-1 h-auto px-2.5 py-2 rounded-none shadow-none font-bold transition-colors ${compactFormat === "excel" ? "bg-success text-success-foreground hover:bg-success/90" : "bg-card text-muted-foreground hover:bg-muted"}`}
        >
          <FileSpreadsheet className="w-3 h-3" aria-hidden="true" />
          {t("reports.export.excel")}
        </Button>
        <Button
          type="button"
          aria-pressed={compactFormat === "pdf"}
          onClick={() => onCompactFormatChange("pdf")}
          className={`flex min-h-11 items-center gap-1 h-auto px-2.5 py-2 rounded-none shadow-none border-s border-border font-bold transition-colors ${compactFormat === "pdf" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-card text-muted-foreground hover:bg-muted"}`}
        >
          <FileText className="w-3 h-3" aria-hidden="true" />
          {t("reports.export.pdf")}
        </Button>
      </div>
      <Button
        type="button"
        aria-label={t("reports.export.exportAs", {
          format: compactFormat === "excel" ? t("reports.export.excel") : t("reports.export.pdf"),
        })}
        onClick={onExport}
        className="flex min-h-11 items-center gap-1.5 h-auto px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
      >
        <Download className="w-3 h-3" aria-hidden="true" />
        {t("reports.export.download")}
      </Button>
    </div>
  );
}
