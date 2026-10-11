import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { ACCOUNT_TYPES, type AccountType, type Account } from "@/lib/data/accountingData";
import { DateRangeFilterBar } from "@/components/ui/DateRangeFilterBar";
import { FormSelect } from "@/components/ui/FormSelect";
import { useTranslation } from "@/hooks/useTranslation";

interface GeneralLedgerFiltersProps {
  typeFilter: AccountType | "all";
  selectedAccount: string;
  dateFrom: string;
  dateTo: string;
  filteredAccounts: Account[];
  onTypeFilterChange: (value: AccountType | "all") => void;
  onSelectedAccountChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export function GeneralLedgerFilters({
  typeFilter,
  selectedAccount,
  dateFrom,
  dateTo,
  filteredAccounts,
  onTypeFilterChange,
  onSelectedAccountChange,
  onDateFromChange,
  onDateToChange,
}: GeneralLedgerFiltersProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("accounting.ledger.filtersAria")}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      <FormSelect
        id="ledger-filter-type"
        name="typeFilter"
        aria-label={t("accounting.coa.filterTypeAria")}
        value={typeFilter}
        onChange={(accountTypeValue) => {
          onTypeFilterChange(accountTypeValue as AccountType | "all");
          onSelectedAccountChange("");
        }}
        options={[
          { value: "all", label: t("accounting.ledger.allTypes") },
          ...ACCOUNT_TYPES.map((type) => ({
            value: type,
            label: t(`accounting.type.${type}` as AppTranslationKey),
          })),
        ]}
      />
      <FormSelect
        id="ledger-filter-account"
        name="selectedAccount"
        aria-label={t("accounting.ledger.selectAccountAria")}
        value={selectedAccount}
        onChange={onSelectedAccountChange}
        placeholder={t("accounting.ledger.selectAccount")}
        options={filteredAccounts.map((account) => ({
          value: account.id,
          label: `${account.code} – ${account.name}`,
        }))}
        className="col-span-2 sm:col-span-1"
      />
      <DateRangeFilterBar
        idPrefix="ledger-date"
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        fromPlaceholder={t("accounting.ledger.from")}
        toPlaceholder={t("accounting.ledger.to")}
        className="col-span-2"
        pickerClassName="w-full min-w-0 flex-1"
      />
    </nav>
  );
}
