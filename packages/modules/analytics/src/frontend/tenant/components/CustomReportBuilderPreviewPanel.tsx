import React from "react";
import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence } from "framer-motion";
import { Database, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { Button } from "@mms/ui";
import { EmptyState } from "@mms/ui";
import { SectionLabel } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { type AppTranslationKey } from "@mms/contracts";
import { DraggableField } from "./CustomReportBuilderDraggableField";
import { type AggregateFn, type PreviewRow } from "./customReportBuilderFields";
import { exportReportExcel, exportReportPdf } from "@mms/fe-core/reporting/reportExportCore";
import { CustomReportBuilderPreviewVisualizer } from "./CustomReportBuilderPreviewVisualizer";
import { buildCustomReportExportColumns } from "./customReportBuilderExport";

interface CustomReportBuilderPreviewPanelProps {
  selectedFields: string[];
  setSelectedFields: Dispatch<SetStateAction<string[]>>;
  previewData: PreviewRow[];
  aggregate: AggregateFn;
  groupBy: string;
  reportName: string;
  orientation: "p" | "l";
  pageSize: string;
  removeField: (field: string) => void;
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
  resolveFieldLabel: (field: string) => string;
}

export function CustomReportBuilderPreviewPanel({
  selectedFields,
  setSelectedFields,
  previewData,
  aggregate,
  groupBy,
  reportName,
  orientation,
  pageSize,
  removeField,
  moveUp,
  moveDown,
  resolveFieldLabel,
}: CustomReportBuilderPreviewPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const exportColumns = buildCustomReportExportColumns(selectedFields, resolveFieldLabel);
  const exportRows = previewData as Record<string, unknown>[];
  const safeFilename =
    (reportName || "report")
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_") || "report";

  const handleDropField = (targetIndex: number): void => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    setSelectedFields((current) => {
      if (dragIndex < 0 || dragIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      if (moved === undefined) return current;
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  };

  return (
    <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel as="h3" weight="bold" className="min-w-0 block">
            {t("reports.builder.selectedColumns", { count: selectedFields.length })}
          </SectionLabel>
          {selectedFields.length > 0 && (
            <Button
              onClick={() => setSelectedFields([])}
              variant="link"
              className="min-h-11 shrink-0 text-xs font-bold uppercase tracking-wider text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1 cursor-pointer px-2 hover:no-underline"
              type="button"
            >
              <Trash2 className="w-3.5 h-3.5" /> {t("reports.builder.clearColumns")}
            </Button>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-background/30 p-3 shadow-inner">
          {selectedFields.length === 0 ? (
            <EmptyState
              title={t("reports.builder.emptyColumns")}
              icon={Database}
              compact
              className="italic"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pe-1 custom-scrollbar text-start">
              <AnimatePresence>
                {selectedFields.map((selectedField: any, index: any) => (
                  <DraggableField
                    key={selectedField}
                    field={resolveFieldLabel(selectedField)}
                    onRemove={() => removeField(selectedField)}
                    onMoveUp={() => moveUp(index)}
                    onMoveDown={() => moveDown(index)}
                    isFirst={index === 0}
                    isLast={index === selectedFields.length - 1}
                    onDragStart={() => setDragIndex(index)}
                    onDrop={() => handleDropField(index)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 flex-1 flex flex-col justify-end mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionLabel as="h3" weight="bold" className="block">
              {t("reports.builder.liveVisualizer", { count: previewData.length })}
            </SectionLabel>
            {groupBy && (
              <span className="text-xs font-bold uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded-md">
                {t("reports.builder.groupedBadge")}
              </span>
            )}
            {aggregate !== "None" && (
              <span className="text-xs font-bold uppercase bg-success/15 text-success px-1.5 py-0.5 rounded-md">
                {t(
                  `reports.visualizer.op${aggregate === "Average" ? "Avg" : aggregate}` as AppTranslationKey,
                )}
              </span>
            )}
          </div>

          {previewData.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void exportReportExcel({
                    title: reportName || t("reports.builder.title"),
                    columns: exportColumns,
                    rows: exportRows,
                    filename: safeFilename,
                  })
                }
                variant="capsSuccess"
                size="caps"
                className="shadow-sm"
                type="button"
                title={t("reports.builder.exportExcelTooltip")}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                {t("reports.builder.sheet")} ({exportRows.length})
              </Button>
              <Button
                onClick={() =>
                  void exportReportPdf({
                    title: reportName || t("reports.builder.title"),
                    columns: exportColumns,
                    rows: exportRows,
                    filename: safeFilename,
                    orientation,
                    formatSize: pageSize,
                  })
                }
                variant="capsDestructive"
                size="caps"
                className="shadow-sm"
                type="button"
                title={t("reports.builder.exportPdfTooltip")}
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                {t("reports.builder.document")} ({exportRows.length})
              </Button>
            </div>
          )}
        </div>

        <CustomReportBuilderPreviewVisualizer
          previewData={previewData}
          selectedFields={selectedFields}
          resolveFieldLabel={resolveFieldLabel}
        />

        {previewData.length > 0 && (
          <SectionLabel
            as="div"
            weight="bold"
            tracking="wider"
            className="flex items-center justify-between px-1"
          >
            <span>{t("reports.builder.autoFetched")}</span>
            <span>
              {groupBy
                ? t("reports.builder.groupedBy", { field: resolveFieldLabel(groupBy) })
                : t("reports.builder.flatLayout")}
            </span>
          </SectionLabel>
        )}
      </div>
    </div>
  );
}
