import { useState } from "react";
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

  // The trash view only exists in advanced mode.
  const [prevShowDeleted, setPrevShowDeleted] = useState(false);
  if (prevShowDeleted !== showDeleted) {
    setPrevShowDeleted(showDeleted);
    if (showDeleted) setMode("advanced");
  }

  // The page raises a create request by bumping `createRequestKey`; open the
  // advanced modal for it during render instead of in an effect.
  const [createRequest, setCreateRequest] = useState({
    key: 0,
    canWrite: false,
    showDeleted,
  });
  if (
    createRequest.key !== createRequestKey ||
    createRequest.canWrite !== canWrite ||
    createRequest.showDeleted !== showDeleted
  ) {
    setCreateRequest({ key: createRequestKey, canWrite, showDeleted });
    if (createRequestKey > 0 && canWrite && !showDeleted) {
      setMode("advanced");
      setModal("new");
      setSelected(null);
    }
  }

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
