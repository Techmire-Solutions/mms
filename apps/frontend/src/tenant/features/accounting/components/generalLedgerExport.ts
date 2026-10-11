import { runGridCsvExportJob } from "@/lib/backgroundJobs/runGridCsvExportJob";
import type { AppTranslationKey } from "@mms/shared";
import type { Account } from "@/lib/data/accountingData";
import type { GeneralLedgerLineWithRunning } from "./useGeneralLedger";

type TranslateFn = (key: AppTranslationKey, args?: Record<string, string | number>) => string;

export function exportGeneralLedgerCsv(
  activeAccount: Account,
  linesWithRunning: GeneralLedgerLineWithRunning[],
  t: TranslateFn,
): void {
  runGridCsvExportJob({
    moduleId: "accounting",
    label: t("accounting.ledger.exportLabel", { code: activeAccount.code }),
    filename: `ledger_${activeAccount.code}.csv`,
    columns: [
      { header: t("accounting.ledger.columns.date"), key: "date" },
      { header: t("accounting.ledger.columns.ref"), key: "ref" },
      { header: t("accounting.ledger.columns.description"), key: "description" },
      { header: t("accounting.ledger.columns.lineNote"), key: "lineDesc" },
      { header: t("accounting.ledger.columns.debit"), key: "debit" },
      { header: t("accounting.ledger.columns.credit"), key: "credit" },
      { header: t("accounting.ledger.columns.runningBalance"), key: "running" },
    ],
    rows: linesWithRunning.map((ledgerLine) => ({
      date: ledgerLine.date,
      ref: ledgerLine.ref,
      description: ledgerLine.description,
      lineDesc: ledgerLine.lineDesc || "",
      debit: String(ledgerLine.debit) || "",
      credit: String(ledgerLine.credit) || "",
      running: String(ledgerLine.running),
    })),
  });
}
