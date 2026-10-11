import { useRef, useState } from "react";
import {
  isManuallyReversibleJournalSource,
  type AppTranslationKey,
  type JournalReversalRequest,
} from "@mms/shared";
import { hasReversalEntry, type JournalEntry } from "@/lib/data/accountingData";
import { notify } from "@/lib/notify";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { useReverseJournalEntry } from "@/tenant/features/accounting/hooks/useReverseJournalEntry";

export interface UseJournalEntriesTrashReversalOptions {
  entries: JournalEntry[];
  showDeleted: boolean;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  onDelete?: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkRestore?: (ids: string[]) => void | Promise<void>;
  t: (key: AppTranslationKey, args?: Record<string, string | number>) => string;
}

/**
 * Reason a reversal write was refused, as the bookkeeper must read it.
 *
 * `getApiValidationMessage` unwraps the API error envelope so the server's own
 * explanation (closed period, already reversed, archived account, ineligible
 * source) reaches the bookkeeper instead of "[object Object]".
 */
function describeReverseFailure(error: unknown): string | undefined {
  const apiMessage = getApiValidationMessage(error);
  if (apiMessage) return apiMessage;
  if (error instanceof Error && error.message.trim()) return error.message;
  return undefined;
}

export function useJournalEntriesTrashReversal({
  entries,
  showDeleted,
  selectedIds,
  setSelectedIds,
  onDelete,
  onRestore,
  onBulkDelete,
  onBulkRestore,
  t,
}: UseJournalEntriesTrashReversalOptions) {
  const reverseMutation = useReverseJournalEntry();
  const [pendingTrashId, setPendingTrashId] = useState<string | null>(null);
  const [pendingBulkIds, setPendingBulkIds] = useState<string[]>([]);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [pendingReverseEntry, setPendingReverseEntry] = useState<JournalEntry | null>(null);
  /** Single-flight guard for the reversal write (see confirmReverse). */
  const reverseInFlightRef = useRef(false);

  const requestRowTrash = (id: string) => {
    if (showDeleted) {
      void onRestore?.(id);
      return;
    }
    const entry = entries.find((journalEntry) => journalEntry.id === id);
    if (entry?.status === "posted") {
      notify.warning(t("accounting.journal.alerts.cannotDeletePosted"));
      return;
    }
    setPendingTrashId(id);
  };

  const confirmRowTrash = (): void => {
    if (!pendingTrashId) return;
    void onDelete?.(pendingTrashId);
    setPendingTrashId(null);
  };

  /**
   * Bulk archive with the same posted-entry pre-check the single-row path
   * already applies.
   *
   * Previously the posted rows were simply sent and rejected by the server's SQL
   * filter, which collapsed into a generic "partial failure" count and lost the
   * per-row explanation. Posted rows are now filtered out of the batch, the
   * user is told *which* rows are immutable, and the confirm dialog only opens
   * when something is actually deletable.
   */
  const requestBulkTrash = () => {
    if (showDeleted) {
      // Restore has no immutability rule and no confirm step of its own.
      void onBulkRestore?.(selectedIds);
      setSelectedIds([]);
      return;
    }
    const postedEntries = selectedIds
      .map((id) => entries.find((journalEntry) => journalEntry.id === id))
      .filter((entry): entry is JournalEntry => entry?.status === "posted");
    const deletableIds = selectedIds.filter((id) => {
      const entry = entries.find((journalEntry) => journalEntry.id === id);
      // An id with no loaded row stays in the batch: the server decides.
      return entry ? entry.status !== "posted" : true;
    });

    if (postedEntries.length > 0) {
      notify.warning(
        t("accounting.journal.alerts.bulkPostedBlocked", {
          refs: postedEntries.map((entry) => entry.ref).join(", "),
        }),
      );
    }
    if (deletableIds.length === 0) {
      setPendingBulkIds([]);
      setConfirmBulkOpen(false);
      return;
    }
    setPendingBulkIds(deletableIds);
    setConfirmBulkOpen(true);
  };

  const confirmBulkTrash = (): void => {
    const ids = pendingBulkIds.length > 0 ? pendingBulkIds : selectedIds;
    if (showDeleted) void onBulkRestore?.(ids);
    else void onBulkDelete?.(ids);
    setSelectedIds([]);
    setPendingBulkIds([]);
    setConfirmBulkOpen(false);
  };

  const requestReverse = (entry: JournalEntry) => {
    /**
     * Reverse is refused for an entry that already has a reversal: repeated
     * clicks used to accumulate competing correction entries that could both be
     * posted later, silently reversing the same figure twice.
     */
    if (!isManuallyReversibleJournalSource(entry.source_type)) {
      notify.warning(t("accounting.journal.alerts.notReversible", { ref: entry.ref }));
      return;
    }
    if (hasReversalEntry(entry, entries)) {
      notify.warning(t("accounting.journal.alerts.alreadyReversed", { ref: entry.ref }));
      return;
    }
    setPendingReverseEntry(entry);
  };

  /**
   * Resolves `false` on failure so the dialog stays open with the user's reason
   * and date, letting them pick another open-period date after a refusal.
   */
  const confirmReverse = async (request: JournalReversalRequest): Promise<boolean> => {
    const entry = pendingReverseEntry;
    if (!entry) return false;
    // A double confirmation must not send two reversal requests; the server
    // refuses the second, but the user should not see a spurious error.
    if (reverseInFlightRef.current) return false;
    reverseInFlightRef.current = true;
    try {
      const result = await reverseMutation.mutateAsync({ id: entry.id, request });
      notify.success(t("accounting.journal.alerts.reversalPosted", { ref: result.entry.ref }));
      return true;
    } catch (error: unknown) {
      const description = describeReverseFailure(error);
      notify.error(
        t("accounting.journal.alerts.reverseFailed", { ref: entry.ref }),
        description ? { description } : undefined,
      );
      return false;
    } finally {
      reverseInFlightRef.current = false;
    }
  };

  return {
    pendingTrashId,
    setPendingTrashId,
    requestRowTrash,
    confirmRowTrash,
    confirmBulkOpen,
    setConfirmBulkOpen,
    requestBulkTrash,
    confirmBulkTrash,
    pendingReverseEntry,
    setPendingReverseEntry,
    requestReverse,
    confirmReverse,
  };
}
