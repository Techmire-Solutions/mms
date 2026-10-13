import type { Dispatch, JSX, SetStateAction } from "react";
import { AnimatePresence } from "framer-motion";
import { Database, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionLabel } from "@/components/app/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import { type AppTranslationKey } from "@mms/shared";
import { DraggableField } from "./CustomReportBuilderDraggableField";
import { type AggregateFn, type PreviewRow } from "./customReportBuilderFields";
import { exportReportExcel, exportReportPdf } from "@/lib/reports/reportExportCore";
import { CustomReportBuilderPreviewVisualizer } from "./CustomReportBuilderPreviewVisualizer";

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
}: CustomReportBuilderPreviewPanelProps): JSX.Element {
  const { t } = useTranslation();

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
                {selectedFields.map((selectedField, index) => (
                  <DraggableField
                    key={selectedField}
                    field={resolveFieldLabel(selectedField)}
                    onRemove={() => removeField(selectedField)}
                    onMoveUp={() => moveUp(index)}
                    onMoveDown={() => moveDown(index)}
                    isFirst={index === 0}
                    isLast={index === selectedFields.length - 1}
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
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  void exportReportExcel({
                    title: reportName,
                    rows: previewData as Record<string, unknown>[],
                    filename: reportName,
                  })
                }
                variant="capsSuccess"
                size="caps"
                className="shadow-sm"
                type="button"
                title={t("reports.builder.exportExcelTooltip")}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> {t("reports.builder.sheet")}
              </Button>
              <Button
                onClick={() =>
                  void exportReportPdf({
                    title: reportName,
                    sourceColumns: selectedFields.map((f) => ({
                      header: resolveFieldLabel(f),
                      key: f,
                    })),
                    rows: previewData as Record<string, unknown>[],
                    filename: reportName,
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
                <FileText className="w-3.5 h-3.5" /> {t("reports.builder.document")}
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
