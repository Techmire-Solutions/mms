import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useContactsSyncOutbox } from "@/tenant/features/contacts/hooks/useContactsSyncOutbox";

/**
 * Sync outbox counts plus auto-open of the conflict review panel when new conflicts appear.
 */
export function useContactsConflictPanel(setConflictPanelOpen: Dispatch<SetStateAction<boolean>>) {
  const { pendingCount, conflictCount, flushing, flush } = useContactsSyncOutbox();
  const prevConflictCount = useRef(conflictCount);

  const openConflictReview = () => setConflictPanelOpen(true);

  useEffect(() => {
    if (prevConflictCount.current === 0 && conflictCount > 0) {
      setConflictPanelOpen(true);
    }
    prevConflictCount.current = conflictCount;
  }, [conflictCount, setConflictPanelOpen]);

  return {
    pendingCount,
    conflictCount,
    flushing,
    flush,
    openConflictReview,
  };
}
