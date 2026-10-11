import { motion } from "framer-motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { WORK_SURFACE_INNER } from "@/components/ui/formStyles";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  OutstandingFeeMessagingActions,
  OutstandingFeeOverdueBadge,
  type OpenComposer,
  type OutstandingFeeRow,
} from "@/components/dashboard-widgets/OutstandingFeesTableParts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface OutstandingFeesTableMobileListProps {
  rows: OutstandingFeeRow[];
  canWriteMessaging: boolean;
  formatCurrency: (amount: number) => string;
  openComposer: OpenComposer;
  t: TranslationFunction;
}

export function OutstandingFeesTableMobileList({
  rows,
  canWriteMessaging,
  formatCurrency,
  openComposer,
  t,
}: OutstandingFeesTableMobileListProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("finance.report.noInvoicesMatch")}
        compact
        icon={null}
        className="select-none"
      />
    );
  }

  return (
    <>
      {rows.map((outstandingFee, index) => (
        <motion.article
          key={outstandingFee.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: Math.min(index * 0.02, 0.25), duration: 0.2 }}
          className={`${WORK_SURFACE_INNER} space-y-3 p-3`}
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <UserAvatar
                id={outstandingFee.studentId}
                name={outstandingFee.student}
                size="sm"
                className="shrink-0"
              />
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-foreground m-0">
                  {outstandingFee.student}
                </h4>
                {outstandingFee.class ? (
                  <p className="truncate text-xs text-muted-foreground m-0">
                    {outstandingFee.class}
                  </p>
                ) : null}
              </div>
            </div>
            <span className="shrink-0 text-sm font-bold text-destructive tabular-nums">
              {formatCurrency(outstandingFee.amount)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            <OutstandingFeeOverdueBadge months={outstandingFee.months} t={t} />
            {canWriteMessaging && (
              <OutstandingFeeMessagingActions
                row={outstandingFee}
                openComposer={openComposer}
                t={t}
              />
            )}
          </div>
        </motion.article>
      ))}
    </>
  );
}
