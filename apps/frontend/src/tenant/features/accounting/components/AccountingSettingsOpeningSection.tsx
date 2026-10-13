import React from "react";
import type { Account, FiscalYear } from "@mms/shared";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldErrorMessage,
  FormCollectionShell,
  FormListFieldCard,
  FormSelectWithQuickCreate,
} from "@/components/app/FormPrimitives";
import { SectionCard } from "@/components/app/SectionCard";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import type { MoneySeparator } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import { useAccountingOpeningBalancesState } from "@/tenant/features/accounting/hooks/useAccountingOpeningBalancesState";
import { AccountModal } from "@/tenant/features/accounting/components/AccountModal";
import { useAccountQuickCreate } from "../hooks/useAccountQuickCreate";

interface AccountingSettingsOpeningSectionProps {
  accounts: Account[];
  fiscalYears: FiscalYear[];
  /** `decimalSeparator` preference — money inputs must be parsed with it. */
  decimalSeparator: MoneySeparator;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
}

export function AccountingSettingsOpeningSection({
  accounts,
  fiscalYears,
  decimalSeparator,
  onAccountsChange,
}: AccountingSettingsOpeningSectionProps): React.JSX.Element {
  const {
    t,
    openYears,
    fiscalYearId,
    setFiscalYearId,
    accountId,
    setAccountId,
    debit,
    setDebit,
    credit,
    setCredit,
    formError,
    balances,
    rowsReady,
    accountLabel,
    totals,
    postBlockedReason,
    handleAdd,
    handleRemove,
    handlePost,
    savePending,
    postPending,
    isError,
  } = useAccountingOpeningBalancesState({ accounts, fiscalYears, decimalSeparator });

  const accountQuickCreate = useAccountQuickCreate({
    accounts,
    onAccountsChange,
    onSelectAccount: (_target, nextId) => setAccountId(nextId),
  });

  const accountOptions = accounts
    .filter((account) => account.isActive !== false)
    .map((account) => ({ value: account.id, label: `${account.code} – ${account.name}` }));

  return (
    <SectionCard
      title={t("accounting.settings.secOpening")}
      icon={Scale}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground">
        {t("accounting.settings.opening.hint")}
      </p>
      <Field id="opening-fy" label={t("accounting.settings.fy.label")}>
        <FormSelect
          id="opening-fy"
          name="fiscalYearId"
          value={fiscalYearId}
          onChange={setFiscalYearId}
          options={openYears.map((year) => ({ value: year.id, label: year.label }))}
        />
      </Field>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormSelectWithQuickCreate
          id="opening-account"
          name="accountId"
          value={accountId}
          onChange={setAccountId}
          placeholder={t("accounting.settings.opening.account")}
          aria-label={t("accounting.settings.opening.account")}
          options={accountOptions}
          canAdd={accountQuickCreate.canAdd}
          onOpenAdd={() => accountQuickCreate.openCreate({ kind: "field", field: "debitAcc" })}
          addAriaLabel={t("accounting.coa.addAccount")}
        />
        <Input
          id="opening-debit"
          name="debit"
          className={FORM_INPUT}
          inputMode="decimal"
          value={debit}
          onChange={(event) => setDebit(event.target.value)}
          aria-label={t("accounting.settings.opening.debit")}
        />
        <Input
          id="opening-credit"
          name="credit"
          className={FORM_INPUT}
          inputMode="decimal"
          value={credit}
          onChange={(event) => setCredit(event.target.value)}
          aria-label={t("accounting.settings.opening.credit")}
        />
      </div>
      <FieldErrorMessage message={formError ?? undefined} className="mt-2" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            await handlePost();
          }}
          disabled={!fiscalYearId || !rowsReady || !totals.postable || postPending}
        >
          {t("accounting.settings.opening.post")}
        </Button>
      </div>

      {isError && (
        <p role="alert" className="m-0 mt-3 text-xs text-destructive">
          {t("accounting.settings.opening.loadFailed")}
        </p>
      )}

      <FormCollectionShell
        className="mt-3"
        isEmpty={balances.length === 0}
        addLabel={t("accounting.settings.opening.add")}
        onAdd={() => void handleAdd()}
        addDisabled={!fiscalYearId || !accountId || !rowsReady || savePending}
        listKey="opening-balances"
      >
        {balances.map((row, index) => (
          <FormListFieldCard
            key={row.id}
            id={row.id}
            index={index}
            label={accountLabel(row.accountId)}
            removeLabel={`${t("accounting.settings.opening.remove")} ${accountLabel(row.accountId)}`}
            canRemove={rowsReady && !savePending}
            onRemove={() => void handleRemove(row.id)}
          >
            <span className="flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
              <span>
                {t("accounting.settings.opening.debit")} {row.debit.toFixed(2)}
              </span>
              <span>
                {t("accounting.settings.opening.credit")} {row.credit.toFixed(2)}
              </span>
            </span>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>

      <p className="m-0 mt-3 text-xs text-muted-foreground">
        {t("accounting.settings.opening.count", { count: String(balances.length) })}
      </p>
      {rowsReady && (
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          {t("accounting.settings.opening.totals", {
            debit: (totals.debitCents / 100).toFixed(2),
            credit: (totals.creditCents / 100).toFixed(2),
          })}
        </p>
      )}
      {postBlockedReason && (
        <p className="m-0 mt-1 text-xs text-muted-foreground">{postBlockedReason}</p>
      )}
      {rowsReady && !postBlockedReason && (
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          {t("accounting.settings.opening.balanced")}
        </p>
      )}

      {accountQuickCreate.open ? (
        <AccountModal
          initial={null}
          onSave={accountQuickCreate.handleSave}
          onClose={accountQuickCreate.close}
          existingCodes={accountQuickCreate.existingCodes}
        />
      ) : null}
    </SectionCard>
  );
}
