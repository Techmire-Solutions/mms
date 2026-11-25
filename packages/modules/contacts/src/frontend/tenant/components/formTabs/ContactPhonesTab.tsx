import React, { useCallback } from "react";
import { Phone } from "lucide-react";
import { CardPrimaryButton, EditableSelect } from "@mms/fe-core/components/FormPrimitives";
import type { ContactSubListTabBaseProps } from "./types.js";
import { useTranslation } from "@mms/fe-core/i18n";
import { resolvePhoneLabel } from "@mms/fe-core/lib/contactI18n";
import {
  clampPhoneNumberInput,
  getMaxAllowedPhoneInputLength,
  parsePhoneNumber,
} from "@mms/contracts";
import { ContactLabeledValueSubListTab } from "./ContactLabeledValueSubListTab.js";
import { isSubListItemPrimary } from "./ContactSubListCards.js";

export interface ContactPhonesTabProps extends ContactSubListTabBaseProps {
  phoneLabels: string[];
  onUpdatePhoneLabels: (labels: string[]) => void;
  defaultCountryCode: string;
  countryCodeOptions: string[];
  onUpdateDialCodeOptions: (codes: string[]) => void;
  handlePhoneBlur: (index: number) => void;
}

export function ContactPhonesTab({
  phoneLabels,
  onUpdatePhoneLabels,
  defaultCountryCode,
  countryCodeOptions,
  onUpdateDialCodeOptions,
  handlePhoneBlur,
  ...base
}: ContactPhonesTabProps): React.JSX.Element {
  const { t } = useTranslation();

  const resolveDialCode = useCallback(
    (item: Record<string, unknown>): string =>
      typeof item.countryCode === "string" && item.countryCode
        ? item.countryCode
        : defaultCountryCode,
    [defaultCountryCode],
  );

  return (
    <ContactLabeledValueSubListTab
      {...base}
      listKey="phones"
      labelFieldKey="label"
      valueFieldKey="number"
      valueLabel={t("contacts.fields.phoneNumber")}
      options={phoneLabels}
      onUpdateOptions={onUpdatePhoneLabels}
      resolveLabel={(raw, options, translate) =>
        resolvePhoneLabel(raw as string | undefined, options, translate)
      }
      emptyItem={(resolvedLabel) => ({
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `phone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: resolvedLabel,
        number: "",
        countryCode: defaultCountryCode,
      })}
      icon={Phone}
      emptyMessage={t("contacts.form.noPhoneNumbersYet")}
      addLabel={t("contacts.form.addPhoneNumber")}
      removeLabel={(index) => t("contacts.form.removePhoneNumber", { index })}
      valuePlaceholder={t("contacts.form.phoneNumberPlaceholder")}
      valueInputType="tel"
      valueInputIdPrefix={`cf-${base.formInstanceId}-phone-number`}
      labelSelectIdPrefix={`cf-${base.formInstanceId}-phone-label`}
      autoComplete="tel-national"
      inputMode="tel"
      enterKeyHint="next"
      spellCheck={false}
      onValueBlur={handlePhoneBlur}
      headerExtras={({ item, index }) => {
        const phones = base.contactDraft.phones || [];
        if (phones.length <= 1) return null;
        const isPrimary = isSubListItemPrimary(phones, item, index);
        return (
          <CardPrimaryButton
            isPrimary={isPrimary}
            onClick={() => base.setPrimarySubListItem?.("phones", index)}
            title={isPrimary ? t("contacts.form.primaryPhone") : t("contacts.form.setPrimary")}
            ariaLabel={isPrimary ? t("contacts.form.primaryPhone") : t("contacts.form.setPrimary")}
            primaryLabel={t("contacts.form.primary")}
            setPrimaryLabel={t("contacts.form.setPrimary")}
          />
        );
      }}
      valueMaxLength={(item) =>
        getMaxAllowedPhoneInputLength(
          typeof item.number === "string" ? item.number : "",
          resolveDialCode(item),
        )
      }
      valueLeadingAddon={({ item, index, updateItem }) => (
        <EditableSelect
          options={countryCodeOptions}
          value={resolveDialCode(item)}
          onChange={(val) => {
            const currentNum = typeof item.number === "string" ? item.number : "";
            const clamped = clampPhoneNumberInput(currentNum, val);
            updateItem(index, { countryCode: val, number: clamped });
          }}
          onUpdateOptions={onUpdateDialCodeOptions}
          className="w-phone-prefix shrink-0"
          id={`cf-${base.formInstanceId}-phone-country-${index}`}
          name={`cf-${base.formInstanceId}-phone-country-${index}`}
          aria-label={t("contacts.form.dialCode")}
        />
      )}
      onValueChange={({ value, item, index, updateItem }) => {
        const countryCode = resolveDialCode(item);
        const trimmed = value.trim();
        if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
          const parsed = parsePhoneNumber(value, countryCode, countryCodeOptions);
          const clamped = clampPhoneNumberInput(parsed.number, parsed.countryCode);
          updateItem(index, {
            countryCode: parsed.countryCode,
            number: clamped,
          });
          return;
        }
        const clamped = clampPhoneNumberInput(value, countryCode);
        updateItem(index, { number: clamped });
      }}
    />
  );
}
