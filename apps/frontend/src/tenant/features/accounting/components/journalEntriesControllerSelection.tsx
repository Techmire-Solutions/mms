import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { MODULE_ROW_ACTIONS_TRIGGER_CLASS } from "@/components/ui/ModuleRowActionsMenu";
import type { JournalEntry } from "@/lib/data/accountingData";
import { JournalEntryRowActions } from "@/tenant/features/accounting/components/JournalEntryRowActions";
import {
  extractAmountFromNaturalLanguage,
  parseNaturalLanguage,
  type QuickActionType,
} from "@/tenant/features/accounting/components/journalEntriesQuickActions";

export function createJournalNlHandlers(
  nlInput: string,
  setNlInput: Dispatch<SetStateAction<string>>,
  setNlSuggestion: Dispatch<SetStateAction<QuickActionType | null>>,
  setSimpleModal: Dispatch<
    SetStateAction<{
      prefillType: QuickActionType | null;
      initialAmount?: string;
      initialDescription?: string;
    } | null>
  >,
) {
  const handleNlSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const type = parseNaturalLanguage(nlInput);
    const amount = extractAmountFromNaturalLanguage(nlInput);
    const description = nlInput.trim();
    setSimpleModal({
      prefillType: type ?? null,
      initialAmount: amount ?? undefined,
      initialDescription: description || undefined,
    });
    setNlInput("");
    setNlSuggestion(null);
  };

  const handleNlChange = (inputValue: string) => {
    setNlInput(inputValue);
    setNlSuggestion(inputValue.length > 3 ? parseNaturalLanguage(inputValue) : null);
  };

  return { handleNlSubmit, handleNlChange };
}

interface JournalEntryActionsRendererDeps {
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  setSelected: Dispatch<SetStateAction<JournalEntry | null>>;
  setModal: Dispatch<SetStateAction<"new" | "edit" | "view" | null>>;
  handlePost: (entry: JournalEntry) => void | Promise<void>;
  requestRowTrash: (id: string) => void;
  handleReverse: (entry: JournalEntry) => void | Promise<void>;
  printVoucher?: (entry: JournalEntry) => void | Promise<void>;
  canPrintVoucher?: (entry: JournalEntry) => boolean;
}

export interface JournalEntryActionsRendererOptions {
  /** Shared overflow trigger class (table vs card variants). */
  triggerClassName?: string;
  /** Omit View when the card surface already exposes a View control. */
  hideViewItem?: boolean;
}

export function createJournalEntryActionsRenderer(
  deps: JournalEntryActionsRendererDeps,
  options: JournalEntryActionsRendererOptions = {},
) {
  return (entry: JournalEntry): ReactNode => (
    <JournalEntryRowActions
      entry={entry}
      canWrite={deps.canWrite}
      canDelete={deps.canDelete}
      showDeleted={deps.showDeleted}
      triggerClassName={options.triggerClassName ?? MODULE_ROW_ACTIONS_TRIGGER_CLASS}
      hideViewItem={options.hideViewItem}
      onView={(journalEntry) => {
        deps.setSelected(journalEntry);
        deps.setModal("view");
      }}
      onEdit={(journalEntry) => {
        deps.setSelected(journalEntry);
        deps.setModal("edit");
      }}
      onPost={(journalEntry) => {
        void deps.handlePost(journalEntry);
      }}
      onReverse={(journalEntry) => {
        void deps.handleReverse(journalEntry);
      }}
      onTrashAction={(id) => {
        deps.requestRowTrash(id);
      }}
      onPrintVoucher={
        deps.printVoucher && deps.canPrintVoucher?.(entry)
          ? (journalEntry) => {
              void deps.printVoucher?.(journalEntry);
            }
          : undefined
      }
    />
  );
}
