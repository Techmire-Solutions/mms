import { useState } from "react";
import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { notify } from "@/lib/notify";
import { withAddedRecipient } from "./messageComposerRecipientsUtils";

export interface ComposerRecipientsState {
  localRecipients: MessagingRecipient[];
  setLocalRecipients: React.Dispatch<React.SetStateAction<MessagingRecipient[]>>;
  addRecipient: (candidate: MessagingRecipient) => void;
  /** Batch add (picker select-all): one summary toast, duplicates skipped. */
  addRecipients: (candidates: MessagingRecipient[]) => void;
  removeRecipient: (id: string | number) => void;
  /** Batch remove (picker select-all). */
  removeRecipients: (ids: (string | number)[]) => void;
}

/**
 * Recipient selection state for the composer.
 *
 * Split out of `useMessageComposerModel` so the single-row and batch actions
 * stay together (and to keep the model under the 300-line file ceiling).
 */
export function useComposerRecipients(
  initialRecipients: MessagingRecipient[],
  t: TranslationFunction,
): ComposerRecipientsState {
  const [localRecipients, setLocalRecipients] = useState(initialRecipients);

  const addRecipient = (candidate: MessagingRecipient): void => {
    const { next, duplicate } = withAddedRecipient(localRecipients, candidate);
    if (duplicate) {
      notify.warning(t("messaging.recipientAlreadyAdded"));
      return;
    }
    setLocalRecipients(next);
    notify.success(t("messaging.recipientAdded"));
  };

  const addRecipients = (candidates: MessagingRecipient[]): void => {
    const seen = new Set(localRecipients.map((r) => String(r.id)));
    const additions: MessagingRecipient[] = [];
    for (const candidate of candidates) {
      const key = String(candidate.id);
      if (seen.has(key)) continue;
      seen.add(key);
      additions.push(candidate);
    }
    if (additions.length === 0) return;
    setLocalRecipients([...localRecipients, ...additions]);
    // One summary toast: a page-level select-all must not fire one per row.
    notify.success(t("messaging.recipientsAdded", { count: additions.length }));
  };

  const removeRecipient = (id: string | number): void => {
    setLocalRecipients((prev) => prev.filter((r) => String(r.id) !== String(id)));
    notify.success(t("messaging.recipientRemoved"));
  };

  const removeRecipients = (ids: (string | number)[]): void => {
    const removing = new Set(ids.map(String));
    const remaining = localRecipients.filter((r) => !removing.has(String(r.id)));
    const removedCount = localRecipients.length - remaining.length;
    if (removedCount === 0) return;
    setLocalRecipients(remaining);
    notify.success(t("messaging.recipientsRemoved", { count: removedCount }));
  };

  return {
    localRecipients,
    setLocalRecipients,
    addRecipient,
    addRecipients,
    removeRecipient,
    removeRecipients,
  };
}
