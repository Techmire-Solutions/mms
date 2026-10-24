import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { Download } from "lucide-react";
import { ACCOUNT_TYPE_META, type Account } from "@/lib/data/accountingData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingCurrency } from "@/hooks/useCurrency";

interface GeneralLedgerAccountSummaryProps {
  activeAccount: Account;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  onExport: () => void;
}

export function GeneralLedgerAccountSummary({
  activeAccount,
  totalDebit,
  totalCredit,
  balance,
  onExport,
}: GeneralLedgerAccountSummaryProps): React.JSX.Element {
  const { t } = useTranslation();
  const { formatCurrency } = useAccountingCurrency();
  const normalBalance = ACCOUNT_TYPE_META[activeAccount.type]?.normalBalance;

  return (
    <>
      <Card accentColor="primary" className="flex flex-wrap items-start gap-4 px-6 py-4.5">
        <div className="flex-1 min-w-0 ms-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-muted-foreground">
              {activeAccount.code}
            </span>
            <Badge
              pill
              variant="outline"
              className={`px-2 font-bold ${ACCOUNT_TYPE_META[activeAccount.type]?.color}`}
            >
              {t(`accounting.type.${activeAccount.type}` as AppTranslationKey)}
            </Badge>
            {activeAccount.subtype && (
              <span className="text-xs text-muted-foreground">· {activeAccount.subtype}</span>
            )}
          </div>
          <h3 className="text-base font-bold text-foreground m-0">{activeAccount.name}</h3>
          {activeAccount.description && (
            <p className="text-xs text-muted-foreground mt-0.5 m-0">{activeAccount.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 m-0">
            {t("accounting.ledger.normalBalance", {
              direction:
                normalBalance === "debit" ? t("accounting.ledger.dr") : t("accounting.ledger.cr"),
            })}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 text-start sm:grid-cols-3 sm:text-end">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase m-0">
              {t("accounting.ledger.totalDebit")}
            </p>
            <p className="font-mono font-bold text-info m-0">{formatCurrency(totalDebit)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase m-0">
              {t("accounting.ledger.totalCredit")}
            </p>
            <p className="font-mono font-bold text-success m-0">{formatCurrency(totalCredit)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase m-0">
              {t("accounting.ledger.netBalance")}
            </p>
            <p
              className={`font-mono font-bold m-0 ${balance >= 0 ? "text-foreground" : "text-destructive"}`}
            >
              {formatCurrency(Math.abs(balance))}
              <span className="text-xs font-semibold ms-1">
                {balance >= 0 ? t("accounting.ledger.dr") : t("accounting.ledger.cr")}
              </span>
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onExport}
          className="flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" /> {t("accounting.ledger.exportCsv")}
        </Button>
      </div>
    </>
  );
}
