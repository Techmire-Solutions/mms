import type React from "react";
import { MapPin, Building, Landmark } from "lucide-react";
import {
  CardPrimaryButton,
  EditableSelect,
  Field,
  FormCardTypeSelect,
  TYPE_SELECT_WIDTH,
} from "@/components/ui/FormPrimitives";
import { LeadingIconInput } from "@/components/ui/LeadingIconInput";
import { FormListFieldCard } from "@/components/ui/FormPrimitives";
import { cn } from "@/lib/utils";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveAddressLabel } from "@/lib/contacts/contactI18n";
import type { Address } from "@mms/shared";

export interface ContactAddressEntryCardProps {
  addr: Address;
  idx: number;
  localId: string;
  formInstanceId: string;
  showLabel: boolean;
  showLine1: boolean;
  showCity: boolean;
  showState: boolean;
  showCountry: boolean;
  addressLabels: string[];
  onUpdateAddressLabels: (labels: string[]) => void;
  countryOptions: string[];
  onUpdateCountryOptions: (countries: string[]) => void;
  defaultCountry: string;
  isFieldRequired: (collection: "addresses", field: string) => boolean;
  getListItemError: (collection: "addresses", field: string, idx: number) => string | undefined;
  hasMultipleAddresses: boolean;
  isOnlyAddressOrPrimary: boolean;
  onSetPrimary: () => void;
  onUpdateAddress: (patch: Partial<Address> & Record<string, unknown>) => void;
  onRemoveAddress: () => void;
}

export function ContactAddressEntryCard({
  addr,
  idx,
  localId,
  formInstanceId,
  showLabel,
  showLine1,
  showCity,
  showState,
  showCountry,
  addressLabels,
  onUpdateAddressLabels,
  countryOptions,
  onUpdateCountryOptions,
  defaultCountry,
  isFieldRequired,
  getListItemError,
  hasMultipleAddresses,
  isOnlyAddressOrPrimary,
  onSetPrimary,
  onUpdateAddress,
  onRemoveAddress,
}: ContactAddressEntryCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const line1Error = getListItemError("addresses", "line1", idx);
  const cityError = getListItemError("addresses", "city", idx);
  const stateError = getListItemError("addresses", "state", idx);
  const countryError = getListItemError("addresses", "country", idx);

  return (
    <FormListFieldCard
      id={localId}
      index={idx}
      icon={MapPin}
      label={undefined}
      typeSelect={
        showLabel ? (
          <FormCardTypeSelect label={t("contacts.form.type")}>
            <EditableSelect
              options={addressLabels}
              value={resolveAddressLabel(addr.label, addressLabels, t)}
              onChange={(val) => onUpdateAddress({ label: val })}
              onUpdateOptions={onUpdateAddressLabels}
              className={TYPE_SELECT_WIDTH}
              id={`cf-${formInstanceId}-address-label-${idx}`}
              name={`cf-${formInstanceId}-address-label-${idx}`}
            />
          </FormCardTypeSelect>
        ) : undefined
      }
      headerExtras={
        hasMultipleAddresses ? (
          <CardPrimaryButton
            isPrimary={isOnlyAddressOrPrimary}
            onClick={onSetPrimary}
            title={
              isOnlyAddressOrPrimary
                ? t("contacts.form.primaryAddress")
                : t("contacts.form.setPrimary")
            }
            ariaLabel={
              isOnlyAddressOrPrimary
                ? t("contacts.form.primaryAddress")
                : t("contacts.form.setPrimary")
            }
            primaryLabel={t("contacts.form.primary")}
            setPrimaryLabel={t("contacts.form.setPrimary")}
          />
        ) : undefined
      }
      onRemove={onRemoveAddress}
      removeLabel={t("contacts.form.removeAddress", { index: idx + 1 })}
    >
      <div className="space-y-3">
        {showLine1 ? (
          <Field
            label={t("contacts.fields.streetAddress")}
            required={isFieldRequired("addresses", "line1")}
            error={line1Error}
            id={`cf-${formInstanceId}-address-line1-${idx}`}
          >
            <LeadingIconInput
              icon={MapPin}
              id={`cf-${formInstanceId}-address-line1-${idx}`}
              name={`cf-${formInstanceId}-address-line1-${idx}`}
              autoComplete="street-address"
              autoCapitalize="words"
              enterKeyHint="next"
              value={addr.line1 || ""}
              onChange={(e) => onUpdateAddress({ line1: e.target.value })}
              placeholder={t("contacts.fields.streetAddress")}
              className={cn(line1Error && FORM_INPUT_ERROR)}
            />
          </Field>
        ) : null}
        {showCity || showState || showCountry ? (
          <div className="grid grid-cols-1 gap-3 @sm:grid-cols-3">
            {showCity ? (
              <Field
                label={t("contacts.fields.city")}
                required={isFieldRequired("addresses", "city")}
                error={cityError}
                id={`cf-${formInstanceId}-address-city-${idx}`}
              >
                <LeadingIconInput
                  icon={Building}
                  id={`cf-${formInstanceId}-address-city-${idx}`}
                  name={`cf-${formInstanceId}-address-city-${idx}`}
                  autoComplete="address-level2"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  value={addr.city || ""}
                  onChange={(e) => onUpdateAddress({ city: e.target.value })}
                  placeholder={t("contacts.fields.city")}
                  className={cn(cityError && FORM_INPUT_ERROR)}
                />
              </Field>
            ) : null}
            {showState ? (
              <Field
                label={t("contacts.fields.state")}
                required={isFieldRequired("addresses", "state")}
                error={stateError}
                id={`cf-${formInstanceId}-address-state-${idx}`}
              >
                <LeadingIconInput
                  icon={Landmark}
                  id={`cf-${formInstanceId}-address-state-${idx}`}
                  name={`cf-${formInstanceId}-address-state-${idx}`}
                  autoComplete="address-level1"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  value={addr.state || ""}
                  onChange={(e) => onUpdateAddress({ state: e.target.value })}
                  placeholder={t("contacts.fields.state")}
                  className={cn(stateError && FORM_INPUT_ERROR)}
                />
              </Field>
            ) : null}
            {showCountry ? (
              <Field
                label={t("contacts.fields.country")}
                required={isFieldRequired("addresses", "country")}
                error={countryError}
                id={`cf-${formInstanceId}-address-country-${idx}`}
              >
                <EditableSelect
                  options={countryOptions}
                  value={addr.country || defaultCountry || countryOptions[0] || ""}
                  onChange={(val) => onUpdateAddress({ country: val })}
                  onUpdateOptions={onUpdateCountryOptions}
                  className="w-full min-w-0"
                  id={`cf-${formInstanceId}-address-country-${idx}`}
                  name={`cf-${formInstanceId}-address-country-${idx}`}
                  placeholder={t("contacts.fields.country")}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>
    </FormListFieldCard>
  );
}
