import { formatMoney } from "@mms/shared";
import type { JournalEntry } from "@/lib/data/accountingData";
import { runGridCsvExportJob } from "@/lib/backgroundJobs/runGridCsvExportJob";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { getJournalEntryLineTotals } from "@/tenant/features/accounting/lib/journalEntriesListShared";
import type { QuickActionType } from "@/tenant/features/accounting/lib/journalEntriesQuickActions";

export interface JournalEntryActionDeps {
  entries: JournalEntry[];
  showDeleted: boolean;
  t: TranslationFunction;
  onChange: (
    updater: (prev: JournalEntry[]) => JournalEntry[],
  ) => void | JournalEntry[] | Promise<void | JournalEntry[]>;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  setModal: (modal: "new" | "edit" | "view" | null) => void;
  setSelected: (entry: JournalEntry | null) => void;
  setSimpleModal: (
    modal: {
      prefillType: QuickActionType | null;
      initialAmount?: string;
      initialDescription?: string;
    } | null,
  ) => void;
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
}

export function createJournalSaveHandler(
  deps: Pick<JournalEntryActionDeps, "onChange" | "setModal" | "setSelected" | "setSimpleModal">,
) {
  return async (entry: JournalEntry, stayOpen = false): Promise<JournalEntry> => {
    const saved = await deps.onChange((prev) => {
      if (prev.find((journalEntry) => journalEntry.id === entry.id)) {
        return prev.map((journalEntry) => (journalEntry.id === entry.id ? entry : journalEntry));
      }
      return [...prev, entry];
    });
    if (!stayOpen) {
      deps.setModal(null);
      deps.setSelected(null);
      deps.setSimpleModal(null);
    }
    return saved?.find((savedEntry) => savedEntry.id === entry.id) ?? entry;
  };
}

export function createJournalPostHandler(deps: Pick<JournalEntryActionDeps, "onChange">) {
  return async (entry: JournalEntry) => {
    await deps.onChange((prev) =>
      prev.map((journalEntry) =>
        journalEntry.id === entry.id ? { ...journalEntry, status: "posted" } : journalEntry,
      ),
    );
  };
}

export function exportJournalEntriesCsv(filtered: JournalEntry[], t: TranslationFunction): void {
  const rows = filtered.map((journalEntry) => {
    // Cent-exact totals (see getJournalEntryLineTotals): the CSV must carry
    // valid money such as 0.3, never a float artefact 0.30000000000000004.
    const { totalDebit, totalCredit } = getJournalEntryLineTotals(journalEntry);
    return {
      ref: journalEntry.ref,
      date: journalEntry.date,
      description: journalEntry.description,
      tags: (journalEntry.tags || []).join(";"),
      status: journalEntry.status,
      debit: String(totalDebit),
      credit: String(totalCredit),
    };
  });
  runGridCsvExportJob({
    moduleId: "accounting",
    label: t("accounting.journal.exportCurrentPageLabel"),
    filename: "journal_entries_current_page.csv",
    columns: [
      { header: t("accounting.columns.journal.ref"), key: "ref" },
      { header: t("accounting.columns.journal.date"), key: "date" },
      { header: t("accounting.columns.journal.description"), key: "description" },
      { header: t("accounting.columns.journal.tags"), key: "tags" },
      { header: t("accounting.columns.journal.status"), key: "status" },
      { header: t("accounting.columns.journal.debit"), key: "debit" },
      { header: t("accounting.columns.journal.credit"), key: "credit" },
    ],
    rows,
  });
}

export function formatJournalAmount(
  amount: number,
  formatCurrency?: (amount: number) => string,
): string {
  return formatCurrency ? formatCurrency(amount) : formatMoney(amount);
}
