import type { Dispatch, SetStateAction } from "react";
import type { Account, JournalEntry } from "@mms/mod-accounting/frontend/tenant";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import type { JournalEntriesChange } from "@mms/mod-accounting/frontend/tenant";
import type { QuickActionType } from "@mms/mod-accounting/frontend/tenant";
import {
  createJournalPostHandler,
  createJournalSaveHandler,
  exportJournalEntriesCsv,
  formatJournalAmount,
} from "@/tenant/features/accounting/lib/journalEntriesControllerActions";
import { useJournalEntriesTrashReversal } from "@/tenant/features/accounting/hooks/useJournalEntriesTrashReversal";
import { createJournalEntryActionsRenderer } from "@mms/mod-accounting/frontend/tenant";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@mms/ui/app/entityCardChrome";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@mms/ui/app/ModuleRowActionsMenu";
import { isVoucherPrintable } from "@mms/mod-accounting/frontend/tenant";
import { usePaymentVoucherPrint } from "@/tenant/features/accounting/hooks/usePaymentVoucherPrint";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { assertContractOk } from "@mms/fe-core/api/contractError";

export interface UseJournalEntriesActionsOptions {
  entries: JournalEntry[];
  accounts: Account[];
  filtered: JournalEntry[];
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  t: TranslationFunction;
  formatCurrency: (amount: number | string | null | undefined) => string;
  pagingTotal: number;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  onChange: JournalEntriesChange;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  setModal: Dispatch<SetStateAction<"new" | "edit" | "view" | null>>;
  setSelected: Dispatch<SetStateAction<JournalEntry | null>>;
  setSimpleModal: Dispatch<
    SetStateAction<{
      prefillType: QuickActionType | null;
      initialAmount?: string;
      initialDescription?: string;
    } | null>
  >;
}

export function useJournalEntriesActions({
  entries,
  accounts,
  filtered,
  showDeleted,
  canWrite,
  canDelete,
  t,
  formatCurrency,
  pagingTotal,
  selectedIds,
  setSelectedIds,
  onChange,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  setModal,
  setSelected,
  setSimpleModal,
}: UseJournalEntriesActionsOptions) {
  const printVoucher = usePaymentVoucherPrint(accounts);
  const fetchEntry = async (id: string): Promise<JournalEntry> => {
    const response = await apiContract.accounting.getEntry({ params: { id } });
    assertContractOk(response, "Failed to load the journal entry");
    return response.body as JournalEntry;
  };
  const actionDeps = {
    entries,
    showDeleted,
    t,
    onChange,
    fetchEntry,
    onDelete,
    onRestore,
    onBulkDelete,
    onBulkRestore,
    setModal,
    setSelected,
    setSimpleModal,
  };

  const handleSave = createJournalSaveHandler(actionDeps);
  const handlePost = createJournalPostHandler(actionDeps);
  const exportCSV = () => exportJournalEntriesCsv(filtered, t);

  const trashReversal = useJournalEntriesTrashReversal({
    entries,
    showDeleted,
    selectedIds,
    setSelectedIds,
    onDelete,
    onRestore,
    onBulkDelete,
    onBulkRestore,
    t,
  });

  const renderEntryActions = createJournalEntryActionsRenderer(
    {
      canWrite,
      canDelete,
      showDeleted,
      setSelected,
      setModal,
      handlePost,
      requestRowTrash: trashReversal.requestRowTrash,
      handleReverse: trashReversal.requestReverse,
      printVoucher,
      canPrintVoucher: (entry: JournalEntry) => isVoucherPrintable(entry, accounts),
    },
    { triggerClassName: MODULE_ROW_ACTIONS_TRIGGER_CLASS },
  );

  const renderEntryActionsCards = createJournalEntryActionsRenderer(
    {
      canWrite,
      canDelete,
      showDeleted,
      setSelected,
      setModal,
      handlePost,
      requestRowTrash: trashReversal.requestRowTrash,
      handleReverse: trashReversal.requestReverse,
      printVoucher,
      canPrintVoucher: (entry: JournalEntry) => isVoucherPrintable(entry, accounts),
    },
    { triggerClassName: ENTITY_CARD_OVERFLOW_TRIGGER_CLASS, hideViewItem: true },
  );

  return {
    handleSave,
    handlePost,
    exportCSV,
    renderEntryActions,
    renderEntryActionsCards,
    formatAmount: (amount: number) => formatJournalAmount(amount, formatCurrency),
    pageScopeLabel: t("accounting.journal.pageScope", {
      count: entries.length,
      total: pagingTotal,
    }),
    ...trashReversal,
  };
}
