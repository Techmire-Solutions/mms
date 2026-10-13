import { useState, useEffect } from "react";

/**
 * Setup SubTabBar state with dirty-gated discard confirm.
 * Module shells supply initial key, dirtiness, and discard side effects.
 */
export function useModuleSetupSubTabs({
  initialKey,
  isDirty,
  onDiscard,
  onSave,
  onChange,
}: {
  initialKey: string;
  /** True when leaving `currentKey` requires a discard confirm. */
  isDirty: (currentKey: string) => boolean;
  /** Called when the user confirms discard before switching tabs. */
  onDiscard: (leavingKey: string) => void;
  /** Optional save handler to auto-save dirty tab before switching. */
  onSave?: (leavingKey: string) => Promise<void | boolean>;
  /** Called when the active sub-tab changes. */
  onChange?: (nextKey: string) => void;
}) {
  const [sub, setSub] = useState(initialKey);
  const [pendingSubTab, setPendingSubTab] = useState<string | null>(null);

  useEffect(() => {
    if (initialKey && initialKey !== sub && !isDirty(sub)) {
      setSub(initialKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- this effect only reacts to external initialKey changes; depending on `sub`/`isDirty` would re-run on every tab switch and snap the user's chosen tab back.
  }, [initialKey]);

  const discardConfirmOpen = pendingSubTab != null;
  const discardConfirmIsFields = sub === "fields" && isDirty("fields");

  const handleSubTabChange = async (next: string): Promise<void> => {
    if (next === sub) return;
    if (isDirty(sub)) {
      if (onSave) {
        try {
          const res = await onSave(sub);
          if (res === false) return;
          setSub(next);
          onChange?.(next);
          return;
        } catch {
          // If auto-save threw an error, prompt discard dialog
          setPendingSubTab(next);
          return;
        }
      }
      setPendingSubTab(next);
      return;
    }
    setSub(next);
    onChange?.(next);
  };

  const handleConfirmDiscard = (): void => {
    if (!pendingSubTab) return;
    onDiscard(sub);
    const next = pendingSubTab;
    setSub(next);
    setPendingSubTab(null);
    onChange?.(next);
  };

  const clearPendingSubTab = (): void => {
    setPendingSubTab(null);
  };

  return {
    sub,
    showFields: sub === "fields",
    showPrefs: sub === "preferences",
    showLookups: sub === "lookups",
    showSync: sub === "sync",
    discardConfirmOpen,
    discardConfirmIsFields,
    handleSubTabChange,
    handleConfirmDiscard,
    clearPendingSubTab,
  };
}
