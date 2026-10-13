import React from "react";
import { Button } from "@/components/ui/button";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { getWidgetRecordDisplay } from "@/components/reports/pinnedWidgets/widgetRecordDisplay";
import { buildWidgetDrilldownStatusConfig } from "@/components/reports/pinnedWidgets/widgetDrilldownStatusConfig";
import type { useWidgetDrilldownModal } from "@/components/reports/pinnedWidgets/useWidgetDrilldownModal";

type WidgetDrilldownModalRecordsProps = Pick<
  ReturnType<typeof useWidgetDrilldownModal>,
  "t" | "paginatedItems" | "handleToggleStatus" | "handleDeleteDist" | "studentNameMap"
> & {
  widget: CustomWidget;
};

export function WidgetDrilldownModalRecords({
  t,
  widget,
  paginatedItems,
  studentNameMap,
  handleToggleStatus,
  handleDeleteDist,
}: WidgetDrilldownModalRecordsProps): React.JSX.Element {
  const statusConfig = buildWidgetDrilldownStatusConfig(t);

  return (
    <>
      <div className="space-y-3 p-3 md:hidden">
        {paginatedItems.map((recordSource, index) => {
          const { recordId, name, detailText, status, hasAction } = getWidgetRecordDisplay(
            recordSource,
            index,
            widget,
            studentNameMap,
            t,
          );
          return (
            <article key={recordId} className={`${WORK_SURFACE_INNER} space-y-3 p-3`}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-bold text-foreground">{name}</p>
                <StatusBadge status={status.toLowerCase()} size="sm" config={statusConfig} />
              </div>
              <StatGrid columns="1">
                <StatRow
                  label={t("reports.widgets.primaryInfo")}
                  value={detailText}
                  ddClassName="text-muted-foreground font-semibold"
                />
              </StatGrid>
              {(widget.collection === "hasanat_distributions" || hasAction) && (
                <div className="pt-1">
                  {widget.collection === "hasanat_distributions" ? (
                    <Button
                      onClick={() => handleDeleteDist(recordId)}
                      variant="destructive"
                      size="sm"
                      className="w-full px-2.5 rounded font-bold uppercase tracking-wider text-xs shadow-none"
                    >
                      {t("reports.widgets.delete")}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleToggleStatus(recordId)}
                      variant="secondary"
                      size="sm"
                      className="w-full px-2.5 rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-transparent hover:border-transparent font-bold uppercase tracking-wider text-xs shadow-none"
                    >
                      {t("reports.widgets.toggleStatus")}
                    </Button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table className="w-full text-xs">
          <TableHeader>
            <TableRow className="border-b border-border text-muted-foreground uppercase font-black text-xs tracking-wider text-start hover:bg-transparent">
              <TableHead className="pb-3 text-muted-foreground h-auto">
                {t("reports.widgets.refName")}
              </TableHead>
              <TableHead className="pb-3 text-muted-foreground h-auto">
                {t("reports.widgets.primaryInfo")}
              </TableHead>
              <TableHead className="pb-3 text-muted-foreground h-auto">
                {t("reports.widgets.currentStatus")}
              </TableHead>
              <TableHead className="pb-3 text-end text-muted-foreground h-auto">
                {t("reports.widgets.microAction")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {paginatedItems.map((recordSource, index) => {
              const { recordId, name, detailText, status, hasAction } = getWidgetRecordDisplay(
                recordSource,
                index,
                widget,
                studentNameMap,
                t,
              );

              return (
                <TableRow key={recordId} className="hover:bg-muted/10">
                  <TableCell className="py-3.5 pe-2 font-bold text-foreground max-w-cell-md truncate">
                    {name}
                  </TableCell>
                  <TableCell className="py-3.5 text-muted-foreground font-semibold">
                    {detailText}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusBadge status={status.toLowerCase()} size="sm" config={statusConfig} />
                  </TableCell>
                  <TableCell className="py-3.5 text-end">
                    {widget.collection === "hasanat_distributions" ? (
                      <Button
                        onClick={() => handleDeleteDist(recordId)}
                        variant="destructive"
                        size="sm"
                        className="px-2.5 rounded text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all cursor-pointer font-bold uppercase tracking-wider text-xs shadow-none"
                      >
                        {t("reports.widgets.delete")}
                      </Button>
                    ) : hasAction ? (
                      <Button
                        onClick={() => handleToggleStatus(recordId)}
                        variant="secondary"
                        size="sm"
                        className="px-2.5 rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-transparent hover:border-transparent transition-all cursor-pointer font-bold uppercase tracking-wider text-xs shadow-none"
                      >
                        {t("reports.widgets.toggleStatus")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
