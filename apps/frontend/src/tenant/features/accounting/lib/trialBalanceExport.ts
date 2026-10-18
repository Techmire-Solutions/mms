import { runGridCsvExportJob } from "@/lib/backgroundJobs/runGridCsvExportJob";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { type AppTranslationKey } from "@mms/shared";

type TrialBalanceExportRow = {
  code: string;
  name: string;
  type: string;
  debit: string;
  credit: string;
};

export function exportTrialBalanceCsv(
  rows: Array<{
    code: string;
    name: string;
    type: string;
    totalDebit: number;
    totalCredit: number;
  }>,
  grandDebit: number,
  grandCredit: number,
  t: TranslationFunction,
): void {
  const exportRows: TrialBalanceExportRow[] = rows.map((row) => ({
    code: row.code,
    name: row.name,
    type: t(`accounting.type.${row.type}` as AppTranslationKey),
    debit: row.totalDebit.toString(),
    credit: row.totalCredit.toString(),
  }));
  exportRows.push({
    code: "",
    name: t("accounting.tb.grandTotal"),
    type: "",
    debit: grandDebit.toString(),
    credit: grandCredit.toString(),
  });
  runGridCsvExportJob({
    moduleId: "accounting",
    label: t("accounting.tb.exportLabel"),
    filename: "trial_balance.csv",
    columns: [
      { header: t("accounting.columns.account.code"), key: "code" },
      { header: t("accounting.columns.account.name"), key: "name" },
      { header: t("accounting.columns.account.type"), key: "type" },
      { header: t("accounting.columns.journal.debit"), key: "debit" },
      { header: t("accounting.columns.journal.credit"), key: "credit" },
    ],
    rows: exportRows,
  });
}
