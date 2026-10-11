import type { Dispatch, SetStateAction } from "react";
import type { Account, JournalEntry } from "@/lib/data/accountingData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { JournalEntriesChange } from "@/tenant/features/accounting/components/journalEntriesTypes";
import type { QuickActionType } from "@/tenant/features/accounting/components/journalEntriesQuickActions";
import {
  createJournalPostHandler,
  createJournalSaveHandler,
  exportJournalEntriesCsv,
  formatJournalAmount,
} from "@/tenant/features/accounting/components/journalEntriesControllerActions";
import { useJournalEntriesTrashReversal } from "@/tenant/features/accounting/components/useJournalEntriesTrashReversal";
import { createJournalEntryActionsRenderer } from "@/tenant/features/accounting/components/journalEntriesControllerSelection";
import { ENTITY_CARD_OVERFLOW_TRIGGER_CLASS } from "@/components/ui/entityCardChrome";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/ui/ModuleRowActionsMenu";
import { isVoucherPrintable } from "@/tenant/features/accounting/components/paymentVoucherKind";
import { usePaymentVoucherPrint } from "@/tenant/features/accounting/hooks/usePaymentVoucherPrint";

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
  const actionDeps = {
    entries,
    showDeleted,
    t,
    onChange,
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
