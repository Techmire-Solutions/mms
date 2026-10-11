import React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Account, SalaryEntryInput } from "@mms/shared";
import { FormSelectWithQuickCreate } from "@/components/ui/FormPrimitives";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { TranslatedFormMessage } from "@/lib/forms/TranslatedFormMessage";
import { useTranslation } from "@/hooks/useTranslation";
import { AccountModal } from "@/tenant/features/accounting/components/AccountModal";
import { useAccountQuickCreate } from "./useAccountQuickCreate";

interface SpecializedEntrySalaryAccountFieldsProps {
  form: UseFormReturn<SalaryEntryInput>;
  accounts: Account[];
  expenseAccounts: Account[];
  paymentAccounts: Account[];
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
}

export function SpecializedEntrySalaryAccountFields({
  form,
  accounts,
  expenseAccounts,
  paymentAccounts,
  onAccountsChange,
}: SpecializedEntrySalaryAccountFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  const accountQuickCreate = useAccountQuickCreate({
    accounts,
    onAccountsChange,
    onSelectAccount: (target, accountId) => {
      if (target.kind === "field" && target.field === "debitAcc") {
        form.setValue("expenseAccountId", accountId, { shouldDirty: true });
        return;
      }
      if (target.kind === "field" && target.field === "creditAcc") {
        form.setValue("paymentAccountId", accountId, { shouldDirty: true });
      }
    },
  });

  return (
    <>
      <FormField
        control={form.control}
        name="expenseAccountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="specialized-entry-expense-account">
              {t("accounting.journal.specializedEntry.salary.expenseAccount")}
            </FormLabel>
            <FormControl>
              <FormSelectWithQuickCreate
                id="specialized-entry-expense-account"
                name="expenseAccountId"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "", label: t("common.none") },
                  ...expenseAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.code} — ${account.name}`,
                  })),
                ]}
                canAdd={accountQuickCreate.canAdd}
                onOpenAdd={() =>
                  accountQuickCreate.openCreate({ kind: "field", field: "debitAcc" })
                }
                addAriaLabel={t("accounting.coa.addAccount")}
              />
            </FormControl>
            <TranslatedFormMessage messageKey={form.formState.errors.expenseAccountId?.message} />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="paymentAccountId"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="specialized-entry-payment-account">
              {t("accounting.journal.specializedEntry.salary.paymentAccount")}
            </FormLabel>
            <FormControl>
              <FormSelectWithQuickCreate
                id="specialized-entry-payment-account"
                name="paymentAccountId"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "", label: t("common.none") },
                  ...paymentAccounts.map((account) => ({
                    value: account.id,
                    label: `${account.code} — ${account.name}`,
                  })),
                ]}
                canAdd={accountQuickCreate.canAdd}
                onOpenAdd={() =>
                  accountQuickCreate.openCreate({ kind: "field", field: "creditAcc" })
                }
                addAriaLabel={t("accounting.coa.addAccount")}
              />
            </FormControl>
            <TranslatedFormMessage messageKey={form.formState.errors.paymentAccountId?.message} />
          </FormItem>
        )}
      />

      {accountQuickCreate.open ? (
        <AccountModal
          initial={null}
          onSave={accountQuickCreate.handleSave}
          onClose={accountQuickCreate.close}
          existingCodes={accountQuickCreate.existingCodes}
        />
      ) : null}
    </>
  );
}
