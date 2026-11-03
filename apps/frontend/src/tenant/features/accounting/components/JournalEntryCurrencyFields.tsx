import type React from "react";
import { ACCOUNTING_MODULE_MANIFEST, formatMoney } from "@mms/shared";
import { Alert } from "@/components/app/Alert";
import { DocumentCurrencyFields } from "@/components/app/DocumentCurrencyFields";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useAccountingPostingRules } from "@/tenant/features/accounting/hooks/useAccountingLedgerOps";
import type { JournalEntryCurrencyState } from "../hooks/useJournalEntryCurrency";
import { functionalPreview } from "../lib/journalEntryCurrency";

interface JournalEntryCurrencyFieldsProps {
  t: TranslationFunction;
  fx: JournalEntryCurrencyState;
  total: number;
  error?: string;
}

/** Transaction currency + exchange rate for a journal entry, with the functional debit total. */
export function JournalEntryCurrencyFields({
  t,
  fx,
  total,
  error,
}: JournalEntryCurrencyFieldsProps): React.JSX.Element | null {
  const { canEditSetup } = useModulePermissions(ACCOUNTING_MODULE_MANIFEST);
  const rules = useAccountingPostingRules(fx.isForeign);
  const preview = functionalPreview(total, fx.currency, fx.functionalCurrency, fx.rate);
  const roundingMissing = fx.isForeign && rules.isSuccess && !rules.data.fxRoundingAccountId;

  return (
    <>
      <DocumentCurrencyFields
        t={t}
        idPrefix="je"
        fx={fx}
        error={error}
        preview={{
          label: t("fx.field.functionalEquivalent"),
          value:
            preview === null
              ? "—"
              : formatMoney(preview, fx.functionalCurrency, { useSymbol: true }),
        }}
      />
      {roundingMissing && (
        <Alert
          density="compact"
          description={`${t("accounting.fxGuide.journalRoundingMissing")} ${
            canEditSetup
              ? t("accounting.fxGuide.journalRoundingFix")
              : t("accounting.fxGuide.journalRoundingAsk")
          }`}
        />
      )}
    </>
  );
}
