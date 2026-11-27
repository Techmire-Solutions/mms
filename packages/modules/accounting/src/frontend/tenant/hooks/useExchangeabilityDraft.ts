import { useState } from "react";
import {
  currencyExchangeabilityPutSchema,
  generateClientEntityId,
  todayISO,
  type AppTranslationKey,
  type CurrencyExchangeability,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { useCurrencyExchangeability, useSaveCurrencyExchangeability } from "./useAccountingFx";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      const mapped: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const [root, index, field] = issue.path;
        if (root === "currencies" && typeof index === "number" && typeof field === "string") {
          mapped[`${index}.${field}`] = t(
            (issue.message.startsWith("accounting.")
              ? issue.message
              : "common.formPleaseFixErrors") as AppTranslationKey,
          );
        }
      }
      setFieldErrors(mapped);
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
    setFieldErrors({});
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
    fieldErrors,
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
