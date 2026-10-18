import { quickActionLabel } from "../lib/quickActionLabels";
import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { WarningCallout } from "@/components/app/WarningCallout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleTransactionPostingCards } from "./SimpleTransactionPostingCards";
import { SimpleTransactionPostingTable } from "./SimpleTransactionPostingTable";
import { ReviewList } from "@/components/app/ReviewList";
import { useTranslation } from "@/hooks/useTranslation";
import type { Account } from "@/lib/data/accountingData";
import type { QuickActionType, WizardFormState } from "../lib/simpleTransactionWizardTypes";
import { formatDate } from "@mms/shared";
import { parseMoneyInput } from "../lib/simpleTransactionMoney";
import {
  useWorkDirectoryViewMode,
  type WorkDirectoryViewMode,
} from "@/hooks/useWorkDirectoryViewMode";

interface StepReviewProps {
  type: QuickActionType;
  form: WizardFormState;
  accounts: Account[];
  showAdvanced: boolean;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  formatCurrency: (amount: number | string | null | undefined) => string;
  /** R5: jump back to the details step to edit a field */
  onEditDetails?: () => void;
  viewMode?: WorkDirectoryViewMode;
}

interface ReviewRow {
  label: string;
  value: ReactNode;
  /** When set, an edit shortcut is shown for this row (R5) */
  editable?: boolean;
}

function isReviewRow(row: ReviewRow | null): row is ReviewRow {
  return row !== null;
}

export function StepReview({
  type,
  form,
  accounts,
  showAdvanced,
  setShowAdvanced,
  formatCurrency,
  onEditDetails,
  viewMode: propViewMode,
}: StepReviewProps) {
  const { t } = useTranslation();
  const { viewMode: hookViewMode } = useWorkDirectoryViewMode();
  const viewMode = propViewMode ?? hookViewMode;
  // Preserve invalid amounts as unknown, rather than displaying a real zero.
  const amount = parseMoneyInput(form.amount);
  const amountLabel = amount === null ? "—" : formatCurrency(amount);
  const debitAccount = useMemo(
    () => accounts.find((account) => account.id === form.debitAcc),
    [accounts, form.debitAcc],
  );
  const creditAccount = useMemo(
    () => accounts.find((account) => account.id === form.creditAcc),
    [accounts, form.creditAcc],
  );

  const formatAccountName = (account?: Account) => {
    if (!account) return "—";
    return account.code ? `${account.code} — ${account.name}` : account.name;
  };

  const rows = useMemo(() => {
    const accountRows: ReviewRow[] =
      type.groupKey === "accounting.journal.dashboard.group.moneyIn"
        ? [
            {
              label: t("accounting.journal.dashboard.wizard.receivedIntoLabel"),
              value: formatAccountName(debitAccount),
            },
            {
              label: t("accounting.journal.dashboard.wizard.incomeCategory"),
              value: formatAccountName(creditAccount),
            },
          ]
        : type.groupKey === "accounting.journal.dashboard.group.transfers"
          ? [
              {
                label: t("accounting.journal.dashboard.wizard.transferLabel"),
                value: (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span>{formatAccountName(creditAccount)}</span>
                    <span
                      className="inline-block rtl:rotate-180 text-muted-foreground"
                      aria-hidden="true"
                    >
                      →
                    </span>
                    <span>{formatAccountName(debitAccount)}</span>
                  </span>
                ),
              },
            ]
          : [
              {
                label: t("accounting.journal.dashboard.wizard.paidFromLabel"),
                value: formatAccountName(creditAccount),
              },
              {
                label: t("accounting.journal.dashboard.wizard.expenseCategory"),
                value: formatAccountName(debitAccount),
              },
            ];

    return [
      {
        label: t("accounting.journal.dashboard.wizard.transactionType"),
        value: quickActionLabel(type, t),
      },
      { label: t("accounting.columns.journal.date"), value: formatDate(form.date) },
      form.fiscal_year
        ? { label: t("accounting.journal.form.financialYear"), value: form.fiscal_year }
        : null,
      {
        label: t("accounting.journal.dashboard.wizard.amountLabel"),
        value: amountLabel,
        editable: true,
      },
      ...accountRows,
      {
        label: t("accounting.columns.journal.description"),
        value: form.description || "—",
        editable: true,
      },
      form.ref
        ? { label: t("accounting.journal.dashboard.wizard.referenceLabel"), value: form.ref }
        : null,
      form.tags && form.tags.length > 0
        ? {
            label: t("accounting.columns.journal.tags"),
            value: (
              <span className="inline-flex flex-wrap gap-1">
                {form.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="px-2 py-0.5 text-xs font-semibold"
                  >
                    {tag}
                  </Badge>
                ))}
              </span>
            ),
          }
        : null,
    ].filter(isReviewRow);
  }, [type, form, debitAccount, creditAccount, amountLabel, t]);

  return (
    <section aria-label={t("accounting.wizard.reviewAria")} className="space-y-4">
      <ReviewList
        items={rows.map((row) => ({
          label: row.label,
          value: row.value,
          action:
            row.editable && onEditDetails ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onEditDetails}
                aria-label={`${t("common.edit")} ${row.label}`}
                className="shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </Button>
            ) : undefined,
        }))}
      />

      {/* R1: Status banner prominently outside the data table */}
      {amount === null ? (
        <WarningCallout
          tone="destructive"
          role="alert"
          title={t("accounting.journal.dashboard.wizard.errorAmountInvalid")}
        />
      ) : !debitAccount || !creditAccount ? (
        <WarningCallout
          tone="destructive"
          role="alert"
          title={t("accounting.journal.dashboard.wizard.errorSource")}
        />
      ) : debitAccount.id === creditAccount.id ? (
        <WarningCallout
          tone="destructive"
          role="alert"
          title={t("accounting.journal.dashboard.wizard.errorSameAccount")}
        />
      ) : (
        <WarningCallout
          tone="success"
          icon={CheckCircle2}
          title={t("accounting.journal.dashboard.wizard.postMessage")}
        />
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowAdvanced((previousValue) => !previousValue)}
          aria-expanded={showAdvanced}
          aria-controls="wizard-advanced-panel"
          className="w-full h-auto flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          {/* R2: non-jargon label for non-accountant staff */}
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {t("accounting.journal.dashboard.wizard.showAdvanced")}
          </span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          )}
        </Button>
        {showAdvanced && (
          <div id="wizard-advanced-panel" className="p-4 space-y-2">
            {viewMode === "cards" ? (
              <SimpleTransactionPostingCards
                debitAccount={formatAccountName(debitAccount)}
                creditAccount={formatAccountName(creditAccount)}
                amountLabel={amountLabel}
              />
            ) : (
              <SimpleTransactionPostingTable
                debitAccount={formatAccountName(debitAccount)}
                creditAccount={formatAccountName(creditAccount)}
                amountLabel={amountLabel}
              />
            )}
            <p className="text-xs text-muted-foreground m-0">
              {t("accounting.journal.dashboard.wizard.linesAutoGenerated")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
