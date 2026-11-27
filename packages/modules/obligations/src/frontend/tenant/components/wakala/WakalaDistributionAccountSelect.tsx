import React from "react";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { useTranslation } from "@mms/fe-core/i18n";
import {
  useDistributionAccountOptions,
  type DistributionAccountType,
} from "../../hooks/useDistributionAccountOptions";

interface WakalaDistributionAccountSelectProps {
  rowId: string;
  type: DistributionAccountType;
  value: string | null;
  onChange: (accountId: string | null) => void;
}

/** Ledger account picker for one wakala distribution row. */
export function WakalaDistributionAccountSelect({
  rowId,
  type,
  value,
  onChange,
}: WakalaDistributionAccountSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const options = useDistributionAccountOptions(type);

  return (
    <FormSelect
      id={`wakala-dist-account-${rowId}`}
      name={`wakala-dist-account-${rowId}`}
      aria-label={t("obligations.distribution.account")}
      value={value || ""}
      onChange={(next: string) => onChange(next ? next : null)}
      options={options}
      className="text-xs min-h-11"
    />
  );
}
