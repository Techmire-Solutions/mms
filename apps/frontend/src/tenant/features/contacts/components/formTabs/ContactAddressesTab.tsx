import React, { useCallback } from "react";
import { MapPin } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { ContactSubListShell, resolveSubListAllowAdd } from "./ContactSubListCards";
import { ContactAddressEntryCard } from "./ContactAddressEntryCard";
import type { ContactSubListTabBaseProps } from "./types";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveAddressLabel } from "@/lib/contacts/contactI18n";
import type { Address } from "@mms/shared";

export interface ContactAddressesTabProps extends ContactSubListTabBaseProps {
  addressLabels: string[];
  onUpdateAddressLabels: (labels: string[]) => void;
  countryOptions: string[];
  onUpdateCountryOptions: (countries: string[]) => void;
  defaultCity: string;
  defaultProvince: string;
  defaultCountry: string;
}

export function ContactAddressesTab({
  contactDraft,
  getLocalId,
  addressLabels,
  onUpdateAddressLabels,
  countryOptions,
  onUpdateCountryOptions,
  defaultCity,
  defaultProvince,
  defaultCountry,
  getListItemError,
  isFieldEnabled,
  isFieldRequired,
  fields: _fields,
  formInstanceId,
  addSubListItem,
  ensureSubListItem,
  updateSubListItem,
  removeSubListItem,
  setPrimarySubListItem,
}: ContactAddressesTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const showLabel = isFieldEnabled("addresses", "label");
  const showLine1 = isFieldEnabled("addresses", "line1");
  const showCity = isFieldEnabled("addresses", "city");
  const showState = isFieldEnabled("addresses", "state");
  const showCountry = isFieldEnabled("addresses", "country");
  const allowAdd = resolveSubListAllowAdd([showLabel, showLine1, showCity, showState, showCountry]);
  const addresses = contactDraft.addresses || [];

  const emptyAddress = useCallback(
    (): Address => ({
      label: resolveAddressLabel(undefined, addressLabels, t),
      line1: "",
      city: defaultCity,
      state: defaultProvince,
      country: defaultCountry,
    }),
    [addressLabels, defaultCity, defaultCountry, defaultProvince, t],
  );

  const addAddress = useCallback(() => {
    addSubListItem("addresses", emptyAddress());
  }, [addSubListItem, emptyAddress]);

  const ensureAddress = useCallback(() => {
    ensureSubListItem("addresses", emptyAddress());
  }, [ensureSubListItem, emptyAddress]);

  const removeAddress = useCallback(
    (idx: number) => {
      removeSubListItem("addresses", idx);
    },
    [removeSubListItem],
  );

  const handleSetPrimary = useCallback(
    (idx: number) => {
      setPrimarySubListItem?.("addresses", idx);
    },
    [setPrimarySubListItem],
  );

  const updateAddress = useCallback(
    (idx: number, patch: Partial<Address> & Record<string, unknown>) => {
      updateSubListItem("addresses", idx, patch);
    },
    [updateSubListItem],
  );

  return (
    <ContactSubListShell
      isEmpty={addresses.length === 0}
      emptyIcon={MapPin}
      emptyMessage={t("contacts.form.noAddressesYet")}
      addLabel={t("contacts.form.addAddress")}
      onAdd={addAddress}
      onEnsureRow={ensureAddress}
      allowAdd={allowAdd}
    >
      <AnimatePresence initial={false}>
        {addresses.map((addr, idx) => {
          const isOnlyAddressOrPrimary =
            Boolean(addr.isPrimary) || (!addresses.some((a) => a.isPrimary) && idx === 0);

          return (
            <ContactAddressEntryCard
              key={getLocalId("addresses", idx)}
              addr={addr}
              idx={idx}
              localId={getLocalId("addresses", idx)}
              formInstanceId={formInstanceId}
              showLabel={showLabel}
              showLine1={showLine1}
              showCity={showCity}
              showState={showState}
              showCountry={showCountry}
              addressLabels={addressLabels}
              onUpdateAddressLabels={onUpdateAddressLabels}
              countryOptions={countryOptions}
              onUpdateCountryOptions={onUpdateCountryOptions}
              defaultCountry={defaultCountry}
              isFieldRequired={isFieldRequired}
              getListItemError={getListItemError}
              hasMultipleAddresses={addresses.length > 1}
              isOnlyAddressOrPrimary={isOnlyAddressOrPrimary}
              onSetPrimary={() => handleSetPrimary(idx)}
              onUpdateAddress={(patch) => updateAddress(idx, patch)}
              onRemoveAddress={() => removeAddress(idx)}
            />
          );
        })}
      </AnimatePresence>
    </ContactSubListShell>
  );
}
