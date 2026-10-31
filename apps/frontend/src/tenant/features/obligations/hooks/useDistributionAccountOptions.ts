import { useMemo } from "react";
import type { Account } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccountingContractAccounts } from "@/tenant/hooks/collections/accounting";

export type DistributionAccountType = "Income" | "Liability";

interface SelectOption {
  value: string;
  label: string;
}

/**
 * Chart-of-accounts options for the ledger account a wakala distribution credits.
 *
 * Accounts matching the distribution's own side sort first, so a liability
 * share lands on a liability account without hunting through the full chart.
 * The blank option differs by side because only the income side has a
 * workspace-level fallback; a liability share that names no account cannot
 * post at all.
 */
export function useDistributionAccountOptions(type: DistributionAccountType): SelectOption[] {
  const { t } = useTranslation();
  const accountsQuery = useAccountingContractAccounts({});
  const body = accountsQuery.data?.status === 200 ? accountsQuery.data.body : undefined;
  const accounts: Account[] | undefined = body?.accounts;

  return useMemo(() => {
    const blankLabel =
      type === "Liability"
        ? t("obligations.distribution.liabilityAccountRequired")
        : t("obligations.distribution.defaultAccount");
    const blankOption: SelectOption = { value: "", label: blankLabel };
    if (!accounts?.length) return [blankOption];

    const preferredType = type === "Income" ? "Revenue" : "Liability";
    const sorted = accounts.toSorted((left, right) => {
      const leftRank = left.type === preferredType ? 0 : 1;
      const rightRank = right.type === preferredType ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return left.code.localeCompare(right.code);
    });

    return [
      blankOption,
      ...sorted.map((account) => ({
        value: account.id,
        label: `${account.code} - ${account.name} (${account.type})`,
      })),
    ];
  }, [accounts, type, t]);
}
