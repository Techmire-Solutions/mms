import { AlertTriangle } from "lucide-react";
import { Field } from "@/components/ui/FormField";
import { FormSelectWithQuickCreate } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import type { WizardFormState } from "./simpleTransactionWizardTypes";

export interface AccountLegConfig {
  id: string;
  label: string;
  field: "debitAcc" | "creditAcc";
  options: { value: string; label: string }[];
}

interface SimpleTransactionAccountLegsProps {
  prefix: string;
  leg1: AccountLegConfig;
  leg2: AccountLegConfig;
  form: WizardFormState;
  onAccountChange: (field: "debitAcc" | "creditAcc", accountId: string) => void;
  canAddAccount?: boolean;
  onOpenAddAccount?: (field: "debitAcc" | "creditAcc") => void;
  showLowBalanceWarning: boolean;
  isSameAccount: boolean;
}

export function SimpleTransactionAccountLegs({
  prefix,
  leg1,
  leg2,
  form,
  onAccountChange,
  canAddAccount = false,
  onOpenAddAccount,
  showLowBalanceWarning,
  isSameAccount,
}: SimpleTransactionAccountLegsProps) {
  const { t } = useTranslation();
  const selectAccountPlaceholder = t("accounting.journal.form.selectAccount");
  const addAccountLabel = t("accounting.coa.addAccount");

  return (
    <>
      <Field id={leg1.id} label={leg1.label}>
        <FormSelectWithQuickCreate
          id={leg1.id}
          name={leg1.field}
          value={form[leg1.field]}
          onChange={(accountId) => onAccountChange(leg1.field, accountId)}
          options={leg1.options}
          placeholder={selectAccountPlaceholder}
          aria-invalid={isSameAccount}
          aria-describedby={isSameAccount ? `${prefix}-account-same-error` : undefined}
          canAdd={canAddAccount}
          onOpenAdd={onOpenAddAccount ? () => onOpenAddAccount(leg1.field) : undefined}
          addAriaLabel={addAccountLabel}
        />
        {showLowBalanceWarning && leg1.field === "creditAcc" && (
          <p className="flex items-center gap-1 text-xs text-warning mt-1">
            <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
            {t("accounting.journal.dashboard.wizard.lowBalanceWarning")}
          </p>
        )}
      </Field>
      <Field id={leg2.id} label={leg2.label}>
        <FormSelectWithQuickCreate
          id={leg2.id}
          name={leg2.field}
          value={form[leg2.field]}
          onChange={(accountId) => onAccountChange(leg2.field, accountId)}
          options={leg2.options}
          placeholder={selectAccountPlaceholder}
          aria-invalid={isSameAccount}
          aria-describedby={isSameAccount ? `${prefix}-account-same-error` : undefined}
          canAdd={canAddAccount}
          onOpenAdd={onOpenAddAccount ? () => onOpenAddAccount(leg2.field) : undefined}
          addAriaLabel={addAccountLabel}
        />
      </Field>

      {isSameAccount && (
        <div className="sm:col-span-2">
          <p
            id={`${prefix}-account-same-error`}
            className="text-xs text-destructive m-0"
            role="alert"
          >
            {t("accounting.journal.dashboard.wizard.errorSameAccount")}
          </p>
        </div>
      )}
    </>
  );
}
