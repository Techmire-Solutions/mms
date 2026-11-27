import type React from "react";
import { ACCOUNTING_MODULE_MANIFEST, formatMoney } from "@mms/contracts";
import { Alert } from "@mms/ui";
import { DocumentCurrencyFields } from "@mms/fe-core/components/DocumentCurrencyFields";
import type { JournalEntryCurrencyState } from "../hooks/useJournalEntryCurrency";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { useModulePermissions } from "../host/usePermissions";
import { useAccountingPostingRules } from "../hooks/useAccountingLedgerOps";
import { functionalPreview } from "../index";

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
        fx={fx as unknown as React.ComponentProps<typeof DocumentCurrencyFields>["fx"]}
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
