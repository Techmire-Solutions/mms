import React from "react";
import { AnimatePresence } from "framer-motion";
import { ModuleTrashConfirmDialogs } from "@/components/app/ModuleTrashConfirmDialogs";
import { isManuallyReversibleJournalSource, type JournalReversalRequest } from "@mms/shared";
import type { Account, FiscalYear, JournalEntry } from "@/lib/data/accountingData";
import { JournalEntryDetail } from "@/tenant/features/accounting/components/JournalEntryDetail";
import { JournalEntryForm } from "@/tenant/features/accounting/components/JournalEntryForm";
import { JournalReverseDialog } from "@/tenant/features/accounting/components/JournalReverseDialog";
import type { JournalEntrySave } from "../lib/journalEntriesTypes";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { isVoucherPrintable } from "@/tenant/features/accounting/lib/paymentVoucherKind";
import { usePaymentVoucherPrint } from "@/tenant/features/accounting/hooks/usePaymentVoucherPrint";

export type JournalModalMode = "new" | "edit" | "view" | null;

export interface JournalEntriesModalLayerProps {
  modal: JournalModalMode;
  canWrite: boolean;
  canDelete: boolean;
  selected: JournalEntry | null;
  accounts: Account[];
  allEntries?: JournalEntry[];
  entries: JournalEntry[];
  fiscalYears: FiscalYear[];
  onSave: JournalEntrySave;
  onAccountsChange?: (
    updater: Account[] | ((prev: Account[]) => Account[]),
  ) => Promise<void> | void;
  onCloseModal: () => void;
  onEditSelected: () => void;
  onRequestReverse: (entry: JournalEntry) => void;
  onRestoreEntry?: (id: string) => void | Promise<void>;
  pendingTrashId: string | null;
  onPendingTrashIdChange: (id: string | null) => void;
  confirmBulkOpen: boolean;
  onConfirmBulkOpenChange: (open: boolean) => void;
  showDeleted: boolean;
  selectedIds: string[];
  onConfirmRowTrash: () => void;
  onConfirmBulkTrash: () => void;
  pendingReverseEntry: JournalEntry | null;
  onPendingReverseEntryChange: (entry: JournalEntry | null) => void;
  onConfirmReverse: (request: JournalReversalRequest) => Promise<boolean>;
  t: TranslationFunction;
}

export function JournalEntriesModalLayer({
  modal,
  canWrite,
  canDelete,
  selected,
  accounts,
  allEntries,
  entries,
  fiscalYears,
  onSave,
  onAccountsChange,
  onCloseModal,
  onEditSelected,
  onRequestReverse,
  onRestoreEntry,
  pendingTrashId,
  onPendingTrashIdChange,
  confirmBulkOpen,
  onConfirmBulkOpenChange,
  showDeleted,
  selectedIds,
  onConfirmRowTrash,
  onConfirmBulkTrash,
  pendingReverseEntry,
  onPendingReverseEntryChange,
  onConfirmReverse,
  t,
}: JournalEntriesModalLayerProps): React.JSX.Element {
  const printVoucher = usePaymentVoucherPrint(accounts);
  return (
    <>
      <AnimatePresence>
        {canWrite && (modal === "new" || modal === "edit") && (
          <JournalEntryForm
            accounts={accounts}
            entries={allEntries && allEntries.length > 0 ? allEntries : entries}
            initial={modal === "edit" ? selected : null}
            fiscalYears={fiscalYears}
            onSave={onSave}
            onAccountsChange={onAccountsChange}
            onClose={onCloseModal}
          />
        )}
        {modal === "view" &&
          selected &&
          (() => {
            const entry = selected;
            const reversedBy = entry.ref
              ? (allEntries && allEntries.length > 0 ? allEntries : entries).find(
                  (candidate) =>
                    candidate.id !== entry.id &&
                    !candidate.deletedAt &&
                    candidate.reversed_ref === entry.ref,
                )
              : undefined;
            const canReverse =
              canWrite &&
              !entry.deletedAt &&
              !reversedBy &&
              isManuallyReversibleJournalSource(entry.source_type);
            return (
              <JournalEntryDetail
                entry={entry}
                accounts={accounts}
                reversedByRef={reversedBy?.ref}
                onClose={onCloseModal}
                onEdit={canWrite && !entry.deletedAt ? onEditSelected : undefined}
                onReverse={canReverse ? () => onRequestReverse(entry) : undefined}
                onRestore={
                  canDelete && entry.deletedAt && onRestoreEntry
                    ? () => onRestoreEntry?.(entry.id)
                    : undefined
                }
                canRestore={canDelete}
                onPrintVoucher={
                  isVoucherPrintable(entry, accounts) ? () => void printVoucher(entry) : undefined
                }
              />
            );
          })()}
      </AnimatePresence>

      <ModuleTrashConfirmDialogs
        pendingTrashId={pendingTrashId}
        onPendingTrashIdChange={onPendingTrashIdChange}
        confirmBulkOpen={confirmBulkOpen}
        onConfirmBulkOpenChange={onConfirmBulkOpenChange}
        showDeleted={showDeleted}
        selectedCount={selectedIds.length}
        i18nNamespace="accounting"
        onConfirmRowTrash={onConfirmRowTrash}
        onConfirmBulkTrash={onConfirmBulkTrash}
        labels={{
          singleDescription: t("accounting.trash.deleteEntryConfirm"),
        }}
      />

      {pendingReverseEntry && (
        <JournalReverseDialog
          key={pendingReverseEntry.id}
          entry={pendingReverseEntry}
          fiscalYears={fiscalYears}
          onOpenChange={(open) => {
            if (!open) onPendingReverseEntryChange(null);
          }}
          onConfirm={onConfirmReverse}
        />
      )}
    </>
  );
}
