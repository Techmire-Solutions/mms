import { StatGrid, StatRow } from "@/components/ui/StatGrid";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export function SimpleTransactionPostingCards({
  debitAccount,
  creditAccount,
  amountLabel,
}: {
  debitAccount: string;
  creditAccount: string;
  amountLabel: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const postings = [
    {
      key: "debit",
      account: debitAccount,
      debit: amountLabel,
      credit: "—",
      surface: "bg-info/10",
      debitClass: "font-bold text-info",
      creditClass: "text-muted-foreground",
    },
    {
      key: "credit",
      account: creditAccount,
      debit: "—",
      credit: amountLabel,
      surface: "bg-success/10",
      debitClass: "text-muted-foreground",
      creditClass: "font-bold text-success",
    },
  ];
  return (
    <div className="space-y-3">
      {postings.map((posting) => (
        <article
          key={posting.key}
          className={cn("space-y-2 rounded-xl border border-border p-3", posting.surface)}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase m-0">
            {t("accounting.journal.detail.account")}
          </p>
          <p className="text-sm font-semibold text-foreground m-0">{posting.account}</p>
          <StatGrid>
            <StatRow
              label={t("accounting.columns.journal.debit")}
              value={posting.debit}
              ddClassName={cn("font-mono text-xs", posting.debitClass)}
            />
            <StatRow
              label={t("accounting.columns.journal.credit")}
              value={posting.credit}
              ddClassName={cn("font-mono text-xs", posting.creditClass)}
            />
          </StatGrid>
        </article>
      ))}
    </div>
  );
}
