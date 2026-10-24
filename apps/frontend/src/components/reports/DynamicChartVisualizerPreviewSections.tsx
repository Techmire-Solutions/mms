import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Table as TableIcon } from "lucide-react";
import { formatNumber } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { SectionLabel } from "@/components/app/SectionLabel";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type {
  AggregatedItem,
  ChartOperation,
} from "@/components/reports/dynamicChartVisualizerTypes";

interface VisualizerKpiCardsProps {
  processedData: AggregatedItem[];
  t: TranslationFunction;
}

export function VisualizerKpiCards({
  processedData,
  t,
}: VisualizerKpiCardsProps): React.JSX.Element | null {
  if (processedData.length === 0) return null;
  const totalValue = processedData.reduce((sum, aggregatedItem) => sum + aggregatedItem.value, 0);
  const avgGroupValue = Math.round(totalValue / processedData.length);
  const topGroup = processedData[0]?.name || "N/A";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="p-3 border border-border bg-card/30 rounded-2xl flex flex-col justify-between">
        <SectionLabel weight="bold" tracking="wider" className="block">
          {t("reports.visualizer.totalAggregated")}
        </SectionLabel>
        <span className="text-sm font-black text-foreground mt-1 leading-none">
          {formatNumber(totalValue)}
        </span>
      </div>
      <div className="p-3 border border-border bg-card/30 rounded-2xl flex flex-col justify-between">
        <SectionLabel weight="bold" tracking="wider" className="block">
          {t("reports.visualizer.avgPerGroup")}
        </SectionLabel>
        <span className="text-sm font-black text-foreground mt-1 leading-none">
          {formatNumber(avgGroupValue)}
        </span>
      </div>
      <div className="p-3 border border-border bg-card/30 rounded-2xl flex flex-col justify-between">
        <SectionLabel weight="bold" tracking="wider" className="block">
          {t("reports.visualizer.topGroup")}
        </SectionLabel>
        <span className="text-sm font-black text-foreground mt-1 leading-none truncate block max-w-full">
          {topGroup}
        </span>
      </div>
    </div>
  );
}

interface VisualizerDataMatrixProps {
  showDataTable: boolean;
  processedData: AggregatedItem[];
  operation: ChartOperation;
  onToggleDataTable: () => void;
  t: TranslationFunction;
}

export function VisualizerDataMatrix({
  showDataTable,
  processedData,
  operation,
  onToggleDataTable,
  t,
}: VisualizerDataMatrixProps): React.JSX.Element {
  return (
    <div className="border-t border-border/40 pt-4 flex flex-col gap-3">
      <Button
        type="button"
        variant="ghost"
        onClick={onToggleDataTable}
        className="min-h-11 w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground select-none shadow-none px-0"
      >
        <span className="flex items-center gap-1.5">
          <TableIcon className="w-4 h-4 text-primary" />
          {t("reports.visualizer.dataMatrix")}
        </span>
        {showDataTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </Button>

      <AnimatePresence>
        {showDataTable && processedData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border border-border/60 bg-card/25 rounded-2xl overflow-hidden mt-1 max-h-panel-sm overflow-y-auto">
              <div className="space-y-3 p-3 md:hidden">
                {processedData.map((processedRow, index) => (
                  <article key={index} className={`${WORK_SURFACE_INNER} space-y-2 p-3`}>
                    <p className="text-sm font-semibold text-foreground">{processedRow.name}</p>
                    <StatGrid>
                      <StatRow
                        label={t("reports.visualizer.aggregatedValue", {
                          op: operation.toUpperCase(),
                        })}
                        value={formatNumber(processedRow.value)}
                        ddClassName="font-bold text-primary"
                      />
                      <StatRow
                        label={t("reports.visualizer.recordCount")}
                        value={processedRow.count}
                        ddClassName="text-muted-foreground"
                      />
                    </StatGrid>
                  </article>
                ))}
              </div>
              <div className="hidden md:block">
                <Table>
                  <caption className="sr-only">{t("reports.visualizer.dataMatrix")}</caption>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                      <ModuleTableHeaderCell columnKey="category" className="px-4 py-2.5">
                        {t("reports.visualizer.xAxisCategory")}
                      </ModuleTableHeaderCell>
                      <ModuleTableHeaderCell columnKey="value" className="px-4 py-2.5">
                        {t("reports.visualizer.aggregatedValue", { op: operation.toUpperCase() })}
                      </ModuleTableHeaderCell>
                      <ModuleTableHeaderCell columnKey="count" className="px-4 py-2.5">
                        {t("reports.visualizer.recordCount")}
                      </ModuleTableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border/50 font-medium">
                    {processedData.map((processedRow, index) => (
                      <TableRow key={index} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="px-4 py-2.5 text-foreground font-semibold">
                          {processedRow.name}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-primary font-bold">
                          {formatNumber(processedRow.value)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-muted-foreground">
                          {processedRow.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
