import type React from "react";
import type { Account, AppTranslationKey } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";

type FxPostingField = "fxRealizedAccountId" | "fxUnrealizedAccountId" | "fxRoundingAccountId" | "ctaAccountId";

const FX_POSTING_FIELDS: readonly {
  field: FxPostingField;
  types: Account["type"][];
  labelKey: AppTranslationKey;
  hintKey: AppTranslationKey;
}[] = [
  {
    field: "fxRealizedAccountId",
    types: ["Revenue", "Expense"],
    labelKey: "accounting.settings.fields.fxRealizedAccount",
    hintKey: "accounting.settings.fields.fxRealizedAccountHint",
  },
  {
    field: "fxUnrealizedAccountId",
    types: ["Revenue", "Expense"],
    labelKey: "accounting.settings.fields.fxUnrealizedAccount",
    hintKey: "accounting.settings.fields.fxUnrealizedAccountHint",
  },
  {
    field: "fxRoundingAccountId",
    types: ["Revenue", "Expense"],
    labelKey: "accounting.settings.fields.fxRoundingAccount",
    hintKey: "accounting.settings.fields.fxRoundingAccountHint",
  },
  {
    field: "ctaAccountId",
    types: ["Equity"],
    labelKey: "accounting.settings.fields.ctaAccount",
    hintKey: "accounting.settings.fields.ctaAccountHint",
  },
];

interface AccountingSettingsFxPostingFieldsProps {
  accounts: Account[];
  draft: Record<FxPostingField, string>;
  onChange: (field: FxPostingField, value: string) => void;
  accountOptions: (
    accounts: Account[],
    types?: Account["type"] | Account["type"][],
  ) => { value: string; label: string }[];
}

/** IAS 21 posting accounts: realized / unrealized FX, rounding and the translation reserve. */
export function AccountingSettingsFxPostingFields({
  accounts,
  draft,
  onChange,
  accountOptions,
}: AccountingSettingsFxPostingFieldsProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="m-0 mb-3 text-xs font-semibold text-muted-foreground">
        {t("accounting.settings.posting.fxHeading")}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FX_POSTING_FIELDS.map(({ field, types, labelKey, hintKey }) => (
          <Field key={field} id={`accounting-${field}`} label={t(labelKey)} hint={t(hintKey)}>
            <FormSelect
              id={`accounting-${field}`}
              name={field}
              value={draft[field]}
              onChange={(value) => onChange(field, value)}
              placeholder={t("accounting.journal.form.none")}
              options={accountOptions(accounts, types)}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}
