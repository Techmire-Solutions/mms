import React, { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Account, SalaryEntryInput } from "@mms/shared";
import { DatePicker } from "@/components/ui/DatePicker";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { TranslatedFormMessage } from "@/lib/forms/TranslatedFormMessage";
import { useTranslation } from "@/hooks/useTranslation";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import { SpecializedEntrySalaryAccountFields } from "./SpecializedEntrySalaryAccountFields";

export function SpecializedEntrySalaryFields({
  form,
  accounts,
  onAccountsChange,
}: {
  form: UseFormReturn<SalaryEntryInput>;
  accounts: Account[];
  onAccountsChange?: (updater: Account[] | ((prev: Account[]) => Account[])) => Promise<void> | void;
}): React.JSX.Element {
  const { t } = useTranslation();

  const activeAccounts = useMemo(() => accounts.filter((account) => account.isActive), [accounts]);
  const expenseAccounts = useMemo(
    () => activeAccounts.filter((account) => account.type === "Expense"),
    [activeAccounts],
  );
  const paymentAccounts = useMemo(
    () => activeAccounts.filter((account) => account.type === "Asset"),
    [activeAccounts],
  );

  return (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name="staffId"
        render={({ field }) => (
          <FormItem>
            <div className="sm:col-span-2 space-y-2">
              <RegistryPersonSelect
                kind="faculty"
                id="specialized-entry-staff-pick"
                name="specializedEntryStaffPick"
                label={t("accounting.journal.specializedEntry.salary.staff")}
                searchLabel={t("accounting.journal.specializedEntry.salary.staff")}
                searchPlaceholder={t("accounting.journal.specializedEntry.salary.staffSearch")}
                value={field.value || ""}
                onChange={(id) => field.onChange(id)}
                onPick={(id) => field.onChange(id)}
              />
            </div>
            <TranslatedFormMessage messageKey={form.formState.errors.staffId?.message} />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="payPeriod"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="specialized-entry-pay-period">
              {t("accounting.journal.specializedEntry.salary.period")}
            </FormLabel>
            <FormControl>
              <Input
                id="specialized-entry-pay-period"
                name="payPeriod"
                className={FORM_INPUT}
                placeholder="YYYY-MM"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              />
            </FormControl>
            <TranslatedFormMessage messageKey={form.formState.errors.payPeriod?.message} />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="specialized-entry-salary-amount">
                {t("accounting.journal.specializedEntry.amount")}
              </FormLabel>
              <FormControl>
                <Input
                  id="specialized-entry-salary-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={FORM_INPUT}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              </FormControl>
              <TranslatedFormMessage messageKey={form.formState.errors.amount?.message} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="specialized-entry-salary-date">
                {t("accounting.journal.specializedEntry.date")}
              </FormLabel>
              <FormControl>
                <DatePicker
                  id="specialized-entry-salary-date"
                  name="date"
                  value={field.value}
                  onChange={field.onChange}
                  required
                />
              </FormControl>
              <TranslatedFormMessage messageKey={form.formState.errors.date?.message} />
            </FormItem>
          )}
        />
      </div>

      <SpecializedEntrySalaryAccountFields
        form={form}
        accounts={accounts}
        expenseAccounts={expenseAccounts}
        paymentAccounts={paymentAccounts}
        onAccountsChange={onAccountsChange}
      />

      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="specialized-entry-salary-note">
              {t("accounting.journal.specializedEntry.note")}
            </FormLabel>
            <FormControl>
              <Textarea
                id="specialized-entry-salary-note"
                name="note"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
