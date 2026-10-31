import React from "react";
import { Receipt, AlertCircle, Loader2, Printer, CheckCircle2 } from "lucide-react";
import { formatDate, formatMoney } from "@mms/shared";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import type { ObligationCollection } from "@/lib/data/obligationsData";
import { useObligationVoucher } from "@/tenant/features/obligations/hooks/useObligationVoucher";

export interface ObligationVoucherModalProps {
  collection: ObligationCollection | null;
  onClose: () => void;
}

/**
 * Slide-over drawer presenting the full general ledger voucher for an obligation receipt,
 * allowing instant inspection and voucher printing without navigating to Accounting.
 */
export function ObligationVoucherModal({ collection, onClose }: ObligationVoucherModalProps) {
  const { t } = useTranslation();
  const voucherQuery = useObligationVoucher(collection?.id);
  const accounts = React.useMemo(() => voucherQuery.data?.accounts ?? [], [voucherQuery.data]);
  const accountMap = React.useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    for (const a of accounts) {
      map.set(a.id, { code: a.code, name: a.name });
    }
    return map;
  }, [accounts]);

  if (!collection) return null;

  if (voucherQuery.isLoading) {
    return (
      <DetailDrawerShell
        open
        onClose={onClose}
        title={`${t("obligations.voucher.title")} — ${collection.receipt_no}`}
        icon={Receipt}
        size="2xl"
      >
        <div className="flex flex-col items-center justify-center p-12 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </DetailDrawerShell>
    );
  }

  if (voucherQuery.isError || !voucherQuery.data?.entry) {
    return (
      <DetailDrawerShell
        open
        onClose={onClose}
        title={`${t("obligations.voucher.title")} — ${collection.receipt_no}`}
        icon={Receipt}
        size="2xl"
      >
        <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-warning" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("obligations.voucher.notFound")}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void voucherQuery.refetch()}>
              {t("common.retry")}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </DetailDrawerShell>
    );
  }

  const entry = voucherQuery.data.entry;
  const totalDebit = entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={`${t("obligations.voucher.title")} — ${collection.receipt_no}`}
      icon={Receipt}
      size="3xl"
    >
      <div className="space-y-5">
        <Card className="p-4 flex flex-wrap items-center justify-between gap-4 bg-primary/5 border-primary/25">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide m-0">
                {t("obligations.columns.receiptNo")} / {t("accounting.columns.journal.ref")}
              </p>
              <p className="text-lg font-bold text-primary font-mono m-0">
                {entry.ref || entry.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-end">
              <p className="text-xs font-semibold text-muted-foreground uppercase m-0">
                {t("accounting.columns.journal.date")}
              </p>
              <p className="text-sm font-semibold text-foreground m-0">
                {formatDate(entry.date)}
              </p>
            </div>
            <Badge className={SEMANTIC_BADGE.successStrong}>
              {entry.status || "posted"}
            </Badge>
          </div>
        </Card>

        {entry.description && (
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{t("accounting.columns.journal.description")}: </span>
            {entry.description}
          </div>
        )}

        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b text-xs text-muted-foreground font-semibold">
              <tr>
                <th className="px-3 py-2.5 text-start">{t("accounting.journal.voucher.account")}</th>
                <th className="px-3 py-2.5 text-start">{t("accounting.columns.journal.description")}</th>
                <th className="px-3 py-2.5 text-end w-28">{t("accounting.columns.journal.debit")}</th>
                <th className="px-3 py-2.5 text-end w-28">{t("accounting.columns.journal.credit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entry.lines.map((line, idx) => {
                const acc = accountMap.get(line.account_id);
                return (
                  <tr key={line.id || idx} className="hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs font-bold text-primary">
                        {acc?.code || line.account_id}
                      </div>
                      <div className="text-xs text-muted-foreground">{acc?.name || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {line.description || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs font-medium">
                      {line.debit ? formatMoney(line.debit) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-end font-mono text-xs font-medium">
                      {line.credit ? formatMoney(line.credit) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30 border-t font-semibold text-xs">
              <tr>
                <td colSpan={2} className="px-3 py-2.5 text-start">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {isBalanced && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" aria-hidden="true" />
                    )}
                    <span>{t("accounting.journal.voucher.total")}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-end font-mono text-xs font-bold text-foreground">
                  {formatMoney(totalDebit)}
                </td>
                <td className="px-3 py-2.5 text-end font-mono text-xs font-bold text-foreground">
                  {formatMoney(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <footer className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            {t("obligations.actions.printShort")}
          </Button>
          <Button type="button" onClick={onClose} variant="outline">
            {t("common.close")}
          </Button>
        </footer>
      </div>
    </DetailDrawerShell>
  );
}
