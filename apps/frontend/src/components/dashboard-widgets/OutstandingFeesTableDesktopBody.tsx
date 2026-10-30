import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { ModuleTableHeaderCell } from "@/components/app/ModuleTableHeaderCell";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { UserAvatar } from "@/components/app/UserAvatar";
import { EmptyState } from "@/components/app/EmptyState";
import {
  MotionTableRow,
  OutstandingFeeMessagingActions,
  OutstandingFeeOverdueBadge,
  type OpenComposer,
} from "@/components/dashboard-widgets/OutstandingFeesTableParts";
import type { OutstandingFeeRow } from "@/components/dashboard-widgets/OutstandingFeesTableParts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface OutstandingFeesTableDesktopBodyProps {
  rows: OutstandingFeeRow[];
  canWriteMessaging: boolean;
  formatCurrency: (amount: number) => string;
  openComposer: OpenComposer;
  t: TranslationFunction;
}

export function OutstandingFeesTableDesktopBody({
  rows,
  canWriteMessaging,
  formatCurrency,
  openComposer,
  t,
}: OutstandingFeesTableDesktopBodyProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const isVirtualized = rows.length > 30;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
    enabled: isVirtualized,
  });

  return (
    <div
      ref={parentRef}
      className={cn(
        "hidden overflow-x-auto md:block",
        isVirtualized && "max-h-120 overflow-y-auto",
      )}
    >
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow className="border-b border-border/45 bg-muted/30 hover:bg-transparent">
            <ModuleTableHeaderCell columnKey="student" className="px-5 py-3 select-none">
              {t("hasanat.columns.redemption.student")}
            </ModuleTableHeaderCell>
            <ModuleTableHeaderCell
              columnKey="class"
              className="px-3 py-3 hidden sm:table-cell select-none"
            >
              {t("sessions.report.colClass")}
            </ModuleTableHeaderCell>
            <ModuleTableHeaderCell
              columnKey="amount"
              noWrap
              variant="currency"
              className="px-3 py-3 select-none"
            >
              {t("finance.columns.amount")}
            </ModuleTableHeaderCell>
            <ModuleTableHeaderCell
              columnKey="overdue"
              noWrap
              variant="badge"
              className="px-3 py-3 hidden md:table-cell select-none"
            >
              {t("finance.metrics.overdue")}
            </ModuleTableHeaderCell>
            {canWriteMessaging && (
              <ModuleTableHeaderCell
                columnKey="actions"
                noWrap
                variant="action"
                className="px-3 py-3 select-none"
              >
                {t("hasanat.columns.actions")}
              </ModuleTableHeaderCell>
            )}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/50">
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWriteMessaging ? 5 : 4} className="p-0">
                <EmptyState
                  title={t("finance.report.noInvoicesMatch")}
                  compact
                  icon={null}
                  className="select-none"
                />
              </TableCell>
            </TableRow>
          ) : isVirtualized ? (
            <>
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <TableRow
                  style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}
                  className="border-0 hover:bg-transparent"
                >
                  <TableCell colSpan={canWriteMessaging ? 5 : 4} className="p-0 border-0" />
                </TableRow>
              )}
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const outstandingFee = rows[virtualRow.index];
                return (
                  <TableRow key={outstandingFee.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="px-5 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          id={outstandingFee.studentId}
                          name={outstandingFee.student}
                          size="sm"
                          className="shrink-0"
                        />
                        <span className="text-sm font-semibold text-foreground truncate">
                          {outstandingFee.student}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell
                      truncate
                      className="px-3 py-3 text-sm text-muted-foreground font-medium hidden sm:table-cell max-w-36"
                    >
                      {outstandingFee.class}
                    </TableCell>
                    <TableCell variant="currency" noWrap className="px-3 py-3">
                      <span className="text-sm font-bold text-destructive">
                        {formatCurrency(outstandingFee.amount)}
                      </span>
                    </TableCell>
                    <TableCell variant="badge" noWrap className="px-3 py-3 hidden md:table-cell">
                      <OutstandingFeeOverdueBadge months={outstandingFee.months} t={t} />
                    </TableCell>
                    {canWriteMessaging && (
                      <TableCell variant="action" noWrap className="px-3 py-3">
                        <OutstandingFeeMessagingActions
                          row={outstandingFee}
                          openComposer={openComposer}
                          t={t}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {rowVirtualizer.getVirtualItems().length > 0 && (
                <TableRow
                  style={{
                    height: `${
                      rowVirtualizer.getTotalSize() -
                      rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]
                        .end
                    }px`,
                  }}
                  className="border-0 hover:bg-transparent"
                >
                  <TableCell colSpan={canWriteMessaging ? 5 : 4} className="p-0 border-0" />
                </TableRow>
              )}
            </>
          ) : (
            rows.map((outstandingFee, index) => (
              <MotionTableRow
                key={outstandingFee.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.25), duration: 0.2 }}
                className="hover:bg-muted/20 transition-colors"
              >
                <TableCell className="px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar
                      id={outstandingFee.studentId}
                      name={outstandingFee.student}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="text-sm font-semibold text-foreground truncate">
                      {outstandingFee.student}
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  truncate
                  className="px-3 py-3 text-sm text-muted-foreground font-medium hidden sm:table-cell max-w-36"
                >
                  {outstandingFee.class}
                </TableCell>
                <TableCell variant="currency" noWrap className="px-3 py-3">
                  <span className="text-sm font-bold text-destructive">
                    {formatCurrency(outstandingFee.amount)}
                  </span>
                </TableCell>
                <TableCell variant="badge" noWrap className="px-3 py-3 hidden md:table-cell">
                  <OutstandingFeeOverdueBadge months={outstandingFee.months} t={t} />
                </TableCell>
                {canWriteMessaging && (
                  <TableCell variant="action" noWrap className="px-3 py-3">
                    <OutstandingFeeMessagingActions
                      row={outstandingFee}
                      openComposer={openComposer}
                      t={t}
                    />
                  </TableCell>
                )}
              </MotionTableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
