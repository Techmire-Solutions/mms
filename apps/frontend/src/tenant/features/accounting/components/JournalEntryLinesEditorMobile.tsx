import { memo, useMemo } from "react";
import type { AppTranslationKey } from "@mms/shared";
import { ACCOUNT_TYPE_META, type Account } from "@/lib/data/accountingData";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/app/FormField";
import { FormListFieldCard, FormSelectWithQuickCreate } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { StatGrid, StatRow } from "@/components/app/StatGrid";
import { useTranslation } from "@/hooks/useTranslation";
import type { DraftLine } from "../lib/journalEntryFormTypes";
import type { JournalAmountSide } from "../hooks/useJournalLineAssist";

export interface JournalEntryLinesEditorMobileProps {
  accounts: readonly Account[];
  accountOptions: readonly { value: string; label: string }[];
  errors: Readonly<Record<string, string>>;
  lines: readonly DraftLine[];
  totalDebit: number;
  totalCredit: number;
  formatCurrency: (amount: number) => string;
  canAddAccount?: boolean;
  onOpenAddAccount?: (lineIndex: number) => void;
  onRemoveLine: (lineIndex: number) => void;
  onUpdateLine: (lineIndex: number, field: keyof DraftLine, fieldValue: string | number) => void;
  lockedSideFor?: (lineId: string) => JournalAmountSide | undefined;
  lockTemplateName?: string | null;
}

interface MobileLineCardProps {
  line: DraftLine;
  lineIndex: number;
  account?: Account;
  accountOptions: readonly { value: string; label: string }[];
  errorMessage?: string;
  canRemove: boolean;
  canAddAccount: boolean;
  lockHint: string;
  lockedSide?: JournalAmountSide;
  onUpdateLine: (lineIndex: number, field: keyof DraftLine, fieldValue: string | number) => void;
  onRemoveLine: (lineIndex: number) => void;
  onOpenAddAccount?: (lineIndex: number) => void;
}

/** One mobile voucher card, memoized so typing in it does not re-render the rest. */
function MobileLineCard({
  line,
  lineIndex,
  account,
  accountOptions,
  errorMessage,
  canRemove,
  canAddAccount,
  lockHint,
  lockedSide,
  onUpdateLine,
  onRemoveLine,
  onOpenAddAccount,
}: MobileLineCardProps) {
  const { t } = useTranslation();
  return (
    <FormListFieldCard
      id={line.id}
      index={lineIndex}
      label={`${lineIndex + 1}`}
      removeLabel={t("accounting.journal.form.lineRemoveAria", { line: lineIndex + 1 })}
      canRemove={canRemove}
      onRemove={() => onRemoveLine(lineIndex)}
    >
      <div className="space-y-3">
        <Field
          id={`line-mobile-${lineIndex}-account`}
          label={t("accounting.journal.detail.account")}
          error={errorMessage}
        >
          <FormSelectWithQuickCreate
            id={`line-mobile-${lineIndex}-account`}
            name={`lines.${lineIndex}.account_id`}
            aria-label={t("accounting.journal.form.lineAccountAria", { line: lineIndex + 1 })}
            value={line.account_id}
            onChange={(accountId) => onUpdateLine(lineIndex, "account_id", accountId)}
            placeholder={t("accounting.journal.form.selectAccount")}
            options={accountOptions}
            searchable
            canAdd={canAddAccount}
            onOpenAdd={onOpenAddAccount ? () => onOpenAddAccount(lineIndex) : undefined}
            addAriaLabel={t("accounting.coa.addAccount")}
          />
          {account && (
            <Badge
              pill
              variant="outline"
              className={`mt-0.5 px-1.5 font-bold ${ACCOUNT_TYPE_META[account.type]?.color}`}
            >
              {t(`accounting.type.${account.type}` as AppTranslationKey)} ·{" "}
              {ACCOUNT_TYPE_META[account.type]?.normalBalance === "debit"
                ? t("accounting.journal.form.drNormal")
                : t("accounting.journal.form.crNormal")}
            </Badge>
          )}
        </Field>
        <Field
          id={`line-mobile-${lineIndex}-description`}
          label={t("accounting.ledger.columns.lineNote")}
        >
          <Input
            id={`line-mobile-${lineIndex}-description`}
            name={`lines.${lineIndex}.description`}
            aria-label={t("accounting.journal.form.lineDescriptionAria", { line: lineIndex + 1 })}
            value={line.description || ""}
            onChange={(event) => onUpdateLine(lineIndex, "description", event.target.value)}
            placeholder={t("accounting.journal.form.notePlaceholder")}
            className="text-xs"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`line-mobile-${lineIndex}-debit`} label={t("accounting.ledger.columns.debit")}>
            <Input
              id={`line-mobile-${lineIndex}-debit`}
              name={`lines.${lineIndex}.debit`}
              type="text"
              inputMode="decimal"
              aria-label={t("accounting.journal.form.lineDebitAria", { line: lineIndex + 1 })}
              value={line.debit}
              placeholder="0.00"
              onChange={(event) => onUpdateLine(lineIndex, "debit", event.target.value)}
              disabled={lockedSide === "credit"}
              title={lockedSide === "credit" ? lockHint : undefined}
              className="bg-info/5 text-end font-mono text-xs focus:ring-info/30"
            />
          </Field>
          <Field
            id={`line-mobile-${lineIndex}-credit`}
            label={t("accounting.ledger.columns.credit")}
          >
            <Input
              id={`line-mobile-${lineIndex}-credit`}
              name={`lines.${lineIndex}.credit`}
              type="text"
              inputMode="decimal"
              aria-label={t("accounting.journal.form.lineCreditAria", { line: lineIndex + 1 })}
              value={line.credit}
              placeholder="0.00"
              onChange={(event) => onUpdateLine(lineIndex, "credit", event.target.value)}
              disabled={lockedSide === "debit"}
              title={lockedSide === "debit" ? lockHint : undefined}
              className="bg-success/5 text-end font-mono text-xs focus:ring-success/30"
            />
          </Field>
        </div>
      </div>
    </FormListFieldCard>
  );
}

function mobileCardPropsEqual(prev: MobileLineCardProps, next: MobileLineCardProps): boolean {
  return (
    prev.line === next.line &&
    prev.lineIndex === next.lineIndex &&
    prev.account === next.account &&
    prev.accountOptions === next.accountOptions &&
    prev.errorMessage === next.errorMessage &&
    prev.canRemove === next.canRemove &&
    prev.canAddAccount === next.canAddAccount &&
    prev.lockHint === next.lockHint &&
    prev.lockedSide === next.lockedSide &&
    prev.onUpdateLine === next.onUpdateLine &&
    prev.onRemoveLine === next.onRemoveLine &&
    prev.onOpenAddAccount === next.onOpenAddAccount
  );
}

const MobileLineCardMemo = memo(MobileLineCard, mobileCardPropsEqual);

export function JournalEntryLinesEditorMobile({
  accounts,
  accountOptions,
  errors,
  lines,
  totalDebit,
  totalCredit,
  formatCurrency,
  canAddAccount = false,
  onOpenAddAccount,
  onRemoveLine,
  onUpdateLine,
  lockedSideFor,
  lockTemplateName,
}: JournalEntryLinesEditorMobileProps) {
  const { t } = useTranslation();
  const lockHint = t("accounting.journal.form.amountLocked", { name: lockTemplateName ?? "" });
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  return (
    <div className="space-y-3 p-3">
      {lines.map((line, lineIndex) => (
        <MobileLineCardMemo
          key={line.id}
          line={line}
          lineIndex={lineIndex}
          account={accountMap.get(line.account_id)}
          accountOptions={accountOptions}
          errorMessage={errors[`line${lineIndex}`] ?? errors[`lineAmount${lineIndex}`]}
          canRemove={lines.length > 2}
          canAddAccount={canAddAccount}
          lockHint={lockHint}
          lockedSide={lockedSideFor?.(line.id)}
          onUpdateLine={onUpdateLine}
          onRemoveLine={onRemoveLine}
          onOpenAddAccount={onOpenAddAccount}
        />
      ))}
      <article className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-bold uppercase text-muted-foreground m-0 mb-2">
          {t("accounting.journal.form.totals")}
        </p>
        <StatGrid>
          <StatRow
            label={t("accounting.ledger.columns.debit")}
            value={formatCurrency(totalDebit)}
            ddClassName="font-mono font-bold text-info"
          />
          <StatRow
            label={t("accounting.ledger.columns.credit")}
            value={formatCurrency(totalCredit)}
            ddClassName="font-mono font-bold text-success"
          />
        </StatGrid>
      </article>
    </div>
  );
}
