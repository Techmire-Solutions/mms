import { useState } from "react";
import {
  currencyExchangeabilityPutSchema,
  generateClientEntityId,
  todayISO,
  type AppTranslationKey,
  type CurrencyExchangeability,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useCurrencyExchangeability,
  useSaveCurrencyExchangeability,
} from "@/tenant/features/accounting/hooks/useAccountingFx";

export interface ExchangeabilityRowDraft {
  key: string;
  currency: string;
  assessedOn: string;
  estimationMethod: string;
  reason: string;
}

const toRow = (row?: CurrencyExchangeability): ExchangeabilityRowDraft => ({
  key: generateClientEntityId("ex", "-"),
  currency: row?.currency ?? "",
  assessedOn: row?.assessedOn ?? todayISO(),
  estimationMethod: row?.estimationMethod ?? "",
  reason: row?.reason ?? "",
});

/** Draft rows + validated save for Setup → Currencies → lack of exchangeability. */
export function useExchangeabilityDraft() {
  const { t } = useTranslation();
  const query = useCurrencyExchangeability();
  const save = useSaveCurrencyExchangeability();
  const [rows, setRows] = useState<ExchangeabilityRowDraft[]>(() =>
    query.data ? query.data.map(toRow) : [],
  );
  const [error, setError] = useState<string | null>(null);

  // Adopt freshly loaded rows during render rather than in an effect.
  const loadedRowsKey = query.data
    ? JSON.stringify(
        query.data.map(({ currency, assessedOn, estimationMethod, reason }) => [
          currency,
          assessedOn,
          estimationMethod,
          reason,
        ]),
      )
    : "";
  const [prevRowsKey, setPrevRowsKey] = useState(loadedRowsKey);
  if (prevRowsKey !== loadedRowsKey) {
    setPrevRowsKey(loadedRowsKey);
    if (query.data) setRows(query.data.map(toRow));
  }

  const handleSave = async (): Promise<void> => {
    const parsed = currencyExchangeabilityPutSchema.safeParse({
      currencies: rows
        .filter((row) => row.currency)
        .map(({ currency, assessedOn, estimationMethod, reason }) => ({
          currency,
          assessedOn,
          estimationMethod,
          reason,
        })),
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "";
      setError(
        t(
          (message.startsWith("accounting.")
            ? message
            : "common.formPleaseFixErrors") as AppTranslationKey,
        ),
      );
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(parsed.data);
      notify.success(t("accounting.settings.fx.exchangeability.saved"));
    } catch (saveError) {
      notify.error(t("accounting.settings.fx.exchangeability.saveFailed"), {
        description: saveError instanceof Error ? saveError.message : String(saveError),
      });
    }
  };

  return {
    rows,
    error,
    saving: save.isPending,
    isError: query.isError,
    refetch: query.refetch,
    addRow: () => setRows((current) => [...current, toRow()]),
    removeRow: (key: string) => setRows((current) => current.filter((row) => row.key !== key)),
    updateRow: (key: string, patch: Partial<ExchangeabilityRowDraft>) =>
      setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    handleSave,
  };
}
