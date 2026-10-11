import { quickActionDescription } from "./quickActionLabels";
import type { Dispatch, SetStateAction } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field } from "@/components/ui/FormField";
import { FormSelect } from "@/components/ui/FormSelect";
import { Input } from "@/components/ui/input";
import type { Account, FiscalYear, JournalEntry } from "@/lib/data/accountingData";
import type { QuickActionType, WizardFormState } from "./simpleTransactionWizardTypes";
import { SimpleTransactionAmountInput } from "./SimpleTransactionAmountInput";
import { SimpleTransactionTagSelector } from "./SimpleTransactionTagSelector";
import { SimpleTransactionHeader } from "./SimpleTransactionHeader";
import { SimpleTransactionAccountLegs } from "./SimpleTransactionAccountLegs";
import { SimpleTransactionRefField } from "./SimpleTransactionRefField";
import { useSimpleTransactionStepFormState } from "./useSimpleTransactionStepFormState";

interface StepTransactionFormProps {
  type: QuickActionType;
  form: WizardFormState;
  setForm: Dispatch<SetStateAction<WizardFormState>>;
  accounts: Account[];
  currencySymbol: string;
  fiscalYears?: FiscalYear[];
  entries?: readonly JournalEntry[];
  formatCurrency?: (amount: number | string | null | undefined) => string;
  idPrefix?: string;
  amountTouched?: boolean;
  onAmountTouched?: () => void;
  onChangeType?: () => void;
  onProceed?: () => void;
  canAddAccount?: boolean;
  onOpenAddAccount?: (field: "debitAcc" | "creditAcc") => void;
}

export function StepTransactionForm({
  type,
  form,
  setForm,
  accounts,
  currencySymbol,
  fiscalYears,
  entries,
  formatCurrency,
  idPrefix,
  amountTouched: amountTouchedProp,
  onAmountTouched,
  onChangeType,
  onProceed,
  canAddAccount = false,
  onOpenAddAccount,
}: StepTransactionFormProps) {
  const {
    t,
    prefix,
    amountTouched,
    markAmountTouched,
    showFiscalYear,
    fiscalYearOptions,
    amountIsInvalid,
    isSameAccount,
    currencyPaddingClass,
    isDuplicateRef,
    showLowBalanceWarning,
    leg1,
    leg2,
  } = useSimpleTransactionStepFormState({
    type,
    form,
    accounts,
    currencySymbol,
    fiscalYears,
    entries,
    formatCurrency,
    idPrefix,
    amountTouchedProp,
    onAmountTouched,
  });

  return (
    <fieldset className="space-y-4 border-0 p-0 m-0">
      <legend className="sr-only">{t("accounting.journal.dashboard.wizard.stepDetails")}</legend>
      <SimpleTransactionHeader type={type} onChangeType={onChangeType} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field id={`${prefix}-date`} label={t("accounting.columns.journal.date")}>
          <DatePicker
            id={`${prefix}-date`}
            name="date"
            value={form.date}
            onChange={(dateValue) => setForm((prev) => ({ ...prev, date: dateValue }))}
          />
        </Field>

        {showFiscalYear && (
          <Field id={`${prefix}-fiscal-year`} label={t("accounting.journal.form.financialYear")}>
            <FormSelect
              id={`${prefix}-fiscal-year`}
              name="fiscalYear"
              value={form.fiscal_year || ""}
              onChange={(fiscalYearValue) => {
                const selected = (fiscalYears || []).find(
                  (fiscalYear) =>
                    fiscalYear.id === fiscalYearValue || fiscalYear.label === fiscalYearValue,
                );
                setForm((prev) => ({
                  ...prev,
                  fiscal_year: selected?.label ?? fiscalYearValue,
                }));
              }}
              placeholder={t("accounting.journal.form.none")}
              options={fiscalYearOptions}
            />
          </Field>
        )}

        <SimpleTransactionAmountInput
          prefix={prefix}
          amount={form.amount}
          currencySymbol={currencySymbol}
          currencyPaddingClass={currencyPaddingClass}
          showAmountRequired={amountTouched && form.amount.trim() === ""}
          amountIsInvalid={amountIsInvalid}
          onChange={(val) => {
            markAmountTouched();
            setForm((prev) => ({ ...prev, amount: val }));
          }}
          onBlur={markAmountTouched}
          onProceed={onProceed}
        />

        <SimpleTransactionRefField
          prefix={prefix}
          refValue={form.ref}
          date={form.date}
          isDuplicateRef={isDuplicateRef}
          onChange={(val) => setForm((prev) => ({ ...prev, ref: val }))}
          onProceed={onProceed}
        />

        <SimpleTransactionAccountLegs
          prefix={prefix}
          leg1={leg1}
          leg2={leg2}
          form={form}
          onAccountChange={(field, accountId) =>
            setForm((prev) => ({ ...prev, [field]: accountId }))
          }
          canAddAccount={canAddAccount}
          onOpenAddAccount={onOpenAddAccount}
          showLowBalanceWarning={showLowBalanceWarning}
          isSameAccount={isSameAccount}
        />

        <div className="sm:col-span-2">
          <Field id={`${prefix}-description`} label={t("accounting.columns.journal.description")}>
            <Input
              id={`${prefix}-description`}
              name="description"
              value={form.description}
              onChange={(event) => {
                const val = event.target.value;
                setForm((prev) => ({ ...prev, description: val }));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onProceed?.();
                }
              }}
              placeholder={quickActionDescription(type, t)}
            />
          </Field>
        </div>

        <SimpleTransactionTagSelector
          typeTag={type.tag}
          tags={form.tags || []}
          onChangeTags={(tags) => setForm((prev) => ({ ...prev, tags }))}
          idPrefix={prefix}
        />
      </div>
    </fieldset>
  );
}
