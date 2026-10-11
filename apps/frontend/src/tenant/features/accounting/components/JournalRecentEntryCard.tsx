import { formatDate } from "@mms/shared";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import type { JournalEntry } from "@/lib/data/accountingData";
import { resolveEntryDirection } from "@/tenant/features/accounting/components/journalEntriesQuickActions";
import {
  getJournalEntryLineTotals,
  getJournalTagLabel,
} from "@/tenant/features/accounting/components/journalEntriesListShared";
import { PaymentVoucherPrintButton } from "@/tenant/features/accounting/components/PaymentVoucherPrintButton";

interface JournalRecentEntryCardProps {
  entry: JournalEntry;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  formatCurrency: (amount: number) => string;
  /** Present only when this entry can print a payment voucher. */
  onPrintVoucher?: (entry: JournalEntry) => void;
}

/** One row of the Simple-mode "Recent transactions" list. */
export function JournalRecentEntryCard({
  entry,
  statusConfig,
  formatCurrency,
  onPrintVoucher,
}: JournalRecentEntryCardProps) {
  const { t } = useTranslation();
  const { totalDebit: amount } = getJournalEntryLineTotals(entry);
  const isMoneyIn = resolveEntryDirection(entry) === "in";

  return (
    <Card
      accentColor={isMoneyIn ? "success" : "destructive"}
      className="flex flex-col gap-3 px-5 py-3 hover:bg-muted/20 transition-all duration-300 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isMoneyIn ? "bg-success/15" : "bg-destructive/15"}`}
          aria-hidden="true"
        >
          {isMoneyIn ? (
            <TrendingUp className="w-4 h-4 text-success" />
          ) : (
            <TrendingUp className="w-4 h-4 text-destructive rotate-180" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate m-0">
            {entry.description}
          </h4>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
            <span className="text-xs font-mono text-muted-foreground">{entry.ref}</span>
            {(entry.tags || []).map((tag) => (
              <Badge key={tag} pill tone="primary" className="px-1.5 font-bold">
                {getJournalTagLabel(tag, t)}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0 ps-12 sm:ps-0">
        <div className="text-end">
          <p
            className={`text-sm font-bold font-mono m-0 ${isMoneyIn ? "text-success" : "text-destructive"}`}
          >
            {isMoneyIn ? "+" : "−"}
            {formatCurrency(amount)}
          </p>
        </div>
        <StatusBadge status={entry.status} config={statusConfig} size="sm" />
        {onPrintVoucher && <PaymentVoucherPrintButton entry={entry} onPrint={onPrintVoucher} />}
      </div>
    </Card>
  );
}
