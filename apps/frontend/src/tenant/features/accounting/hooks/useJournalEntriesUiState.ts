import { useEffect, useState } from "react";
import type { JournalEntry } from "@/lib/data/accountingData";
import type { QuickActionType } from "@/tenant/features/accounting/lib/journalEntriesQuickActions";

export interface UseJournalEntriesUiStateOptions {
  showDeleted?: boolean;
  createRequestKey?: number;
  canWrite?: boolean;
}

export function useJournalEntriesUiState({
  showDeleted = false,
  createRequestKey = 0,
  canWrite = true,
}: UseJournalEntriesUiStateOptions) {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [tab, setTab] = useState<"transactions" | "cashbook">("transactions");
  const [simpleModal, setSimpleModal] = useState<{
    prefillType: QuickActionType | null;
    initialAmount?: string;
    initialDescription?: string;
  } | null>(null);
  const [nlInput, setNlInput] = useState("");
  const [nlSuggestion, setNlSuggestion] = useState<QuickActionType | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState<"new" | "edit" | "view" | null>(null);
  const [selected, setSelected] = useState<JournalEntry | null>(null);

  useEffect(() => {
    if (showDeleted) setMode("advanced");
  }, [showDeleted]);

  useEffect(() => {
    if (createRequestKey > 0 && canWrite && !showDeleted) {
      setMode("advanced");
      setModal("new");
      setSelected(null);
    }
  }, [createRequestKey, canWrite, showDeleted]);

  return {
    mode,
    setMode,
    tab,
    setTab,
    simpleModal,
    setSimpleModal,
    nlInput,
    setNlInput,
    nlSuggestion,
    setNlSuggestion,
    showFilters,
    setShowFilters,
    modal,
    setModal,
    selected,
    setSelected,
  };
}
