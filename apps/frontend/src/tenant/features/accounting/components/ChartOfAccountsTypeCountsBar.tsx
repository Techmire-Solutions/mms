import React from "react";
import { type AppTranslationKey } from "@mms/shared";
import { Badge } from "@/components/ui/badge";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_META, type Account } from "@/lib/data/accountingData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface ChartOfAccountsTypeCountsBarProps {
  accounts: Account[];
  t: TranslationFunction;
}

export function ChartOfAccountsTypeCountsBar({
  accounts,
  t,
}: ChartOfAccountsTypeCountsBarProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2" aria-label={t("accounting.coa.countsAria")}>
      {ACCOUNT_TYPES.map((type) => {
        const count = accounts.filter(
          (account) => account.type === type && account.isActive !== false,
        ).length;
        if (count === 0) return null;
        return (
          <Badge
            key={type}
            pill
            variant="outline"
            className={`px-2.5 py-1 font-bold ${ACCOUNT_TYPE_META[type]?.color}`}
          >
            <span aria-hidden="true">{ACCOUNT_TYPE_META[type]?.icon}</span>{" "}
            {t(`accounting.type.${type}` as AppTranslationKey)}: {count}
          </Badge>
        );
      })}
    </div>
  );
}
