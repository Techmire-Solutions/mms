import React from "react";
import { ACCOUNT_TYPES, type Account, type AccountType } from "@/lib/data/accountingData";
import type { AppTranslationKey } from "@mms/shared";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { useAccountingConfig } from "@/hooks/useStandardModuleConfig";

export interface AccountModalFieldsProps {
  orderedFields: ReturnType<typeof useAccountingConfig>["orderedFields"];
  fields: ReturnType<typeof useAccountingConfig>["fields"];
  isFieldEnabled: (id: string) => boolean;
  form: Partial<Account>;
  errors: Record<string, string>;
  updateField: (key: keyof Account, value: unknown) => void;
  onTypeChange: (type: AccountType) => void;
  subtypes: readonly { value: string; label: string }[] | string[];
  t: TranslationFunction;
}

export function AccountModalFields({
  orderedFields,
  fields,
  isFieldEnabled,
  form,
  errors,
  updateField,
  onTypeChange,
  subtypes,
  t,
}: AccountModalFieldsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {orderedFields.map((field) => {
        const isEnabled = isFieldEnabled(field.id);
        if (!isEnabled) return null;

        if (field.id === "code") {
          return (
            <Field
              key="code"
              id="account-code"
              label={t("accounting.coa.fields.code")}
              required
              error={errors.code}
            >
              <Input
                id="account-code"
                name="code"
                value={form.code || ""}
                onChange={(event) => updateField("code", event.target.value)}
                placeholder={t("accounting.coa.fields.codePlaceholder")}
                required
              />
            </Field>
          );
        }

        if (field.id === "type") {
          return (
            <Field
              key="type"
              id="account-type"
              label={t("accounting.coa.fields.type")}
              required
              error={errors.type}
            >
              <FormSelect
                id="account-type"
                name="type"
                value={form.type || "Asset"}
                onChange={(val) => onTypeChange(val as AccountType)}
                options={ACCOUNT_TYPES.map((accType) => ({
                  value: accType,
                  label: t(`accounting.type.${accType}` as AppTranslationKey),
                }))}
              />
            </Field>
          );
        }

        if (field.id === "name") {
          return (
            <div key="name" className="sm:col-span-2">
              <Field
                id="account-name"
                label={t("accounting.coa.fields.name")}
                required
                error={errors.name}
              >
                <Input
                  id="account-name"
                  name="name"
                  value={form.name || ""}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder={t("accounting.coa.fields.namePlaceholder")}
                  required
                />
              </Field>
            </div>
          );
        }

        if (field.id === "subtype") {
          const isRequired = !!fields[field.id]?.required;
          return (
            <div key="subtype" className="sm:col-span-2">
              <Field
                id="account-subtype"
                label={t("accounting.coa.fields.subtype")}
                required={isRequired}
                error={errors.subtype}
              >
                <FormSelect
                  id="account-subtype"
                  name="subtype"
                  value={form.subtype || ""}
                  onChange={(val) => updateField("subtype", val)}
                  options={subtypes}
                  placeholder={t("accounting.journal.form.none")}
                />
              </Field>
            </div>
          );
        }

        if (field.id === "description") {
          const isRequired = !!fields[field.id]?.required;
          return (
            <div key="description" className="sm:col-span-2">
              <Field
                id="account-description"
                label={t("accounting.coa.fields.description")}
                required={isRequired}
                error={errors.description}
              >
                <Input
                  id="account-description"
                  name="description"
                  value={form.description || ""}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder={t("accounting.coa.fields.descriptionPlaceholder")}
                  required={isRequired}
                />
              </Field>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
