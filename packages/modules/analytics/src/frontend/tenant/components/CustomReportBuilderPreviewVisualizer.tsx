import React from "react";
import type {} from "react";
import { Settings } from "lucide-react";
import { EmptyState } from "@mms/ui";
import { ModuleTableHeaderCell } from "@mms/fe-core/components/ModuleTableHeaderCell";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@mms/ui";
import { WORK_SURFACE, WORK_SURFACE_INNER } from "@mms/ui";
import { StatGrid, StatRow } from "@mms/ui/app/StatGrid";
import { useTranslation } from "@mms/fe-core/i18n";
import { type PreviewRow } from "./customReportBuilderFields";

interface CustomReportBuilderPreviewVisualizerProps {
  previewData: PreviewRow[];
  selectedFields: string[];
  resolveFieldLabel: (field: string) => string;
}

export function CustomReportBuilderPreviewVisualizer({
  previewData,
  selectedFields,
  resolveFieldLabel,
}: CustomReportBuilderPreviewVisualizerProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className={`${WORK_SURFACE} overflow-hidden flex-1 min-h-panel-sm`}>
      {previewData.length === 0 ? (
        <EmptyState
          title={t("reports.builder.waitingData")}
          icon={Settings}
          compact
          className="h-full italic"
        />
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {previewData.map((previewRow: any, rowIndex: any) => (
              <article key={rowIndex} className={`${WORK_SURFACE_INNER} space-y-2 p-3`}>
                <StatGrid columns="1">
                  {selectedFields.map((selectedField: any) => {
                    const fieldLabel = resolveFieldLabel(selectedField);
                    const cellValue = previewRow[fieldLabel];
                    return (
                      <StatRow
                        key={selectedField}
                        label={fieldLabel}
                        value={
                          cellValue !== undefined && cellValue !== null ? (
                            String(cellValue)
                          ) : (
                            <span className="text-muted-foreground text-xs italic">—</span>
                          )
                        }
                        ddClassName="font-semibold"
                      />
                    );
                  })}
                </StatGrid>
              </article>
            ))}
          </div>
          <div className="hidden overflow-auto max-h-72 custom-scrollbar md:block">
            <Table>
              <caption className="sr-only">
                {t("reports.builder.liveVisualizer", { count: previewData.length })}
              </caption>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                  {selectedFields.map((selectedField: any) => (
                    <ModuleTableHeaderCell
                      key={selectedField}
                      columnKey={selectedField}
                      noWrap
                      className="px-4 py-3.5"
                    >
                      {resolveFieldLabel(selectedField)}
                    </ModuleTableHeaderCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {previewData.map((previewRow: any, rowIndex: any) => (
                  <TableRow key={rowIndex} className="hover:bg-primary/5 transition-colors group">
                    {selectedFields.map((selectedField: any) => {
                      const fieldLabel = resolveFieldLabel(selectedField);
                      const cellValue = previewRow[fieldLabel];
                      return (
                        <TableCell
                          key={selectedField}
                          className="px-4 py-3 text-foreground font-semibold group-hover:text-primary transition-colors"
                        >
                          {cellValue !== undefined && cellValue !== null ? (
                            String(cellValue)
                          ) : (
                            <span className="text-muted-foreground text-xs italic">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
