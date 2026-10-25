import { useDeferredValue, useEffect, useState } from "react";
import type { Contact } from "@mms/shared";
import { apiContract } from "@/lib/api";

export interface UseContactDuplicateCheckOptions {
  open: boolean;
  contactId?: string | number;
  contactDraft: Partial<Contact>;
}

export function useContactDuplicateCheck({
  open,
  contactId,
  contactDraft,
}: UseContactDuplicateCheckOptions): number {
  const [duplicateCount, setDuplicateCount] = useState(0);
  // Defer the draft so the check only re-runs once the urgent render settles,
  // rather than on every keystroke; the 600ms timeout below still debounces the
  // actual network request.
  const deferredDraft = useDeferredValue(contactDraft);

  const hasCandidateKey = Boolean(
    open &&
      !contactId &&
      (deferredDraft.name?.trim() ||
        deferredDraft.firstName?.trim() ||
        (deferredDraft.phones && deferredDraft.phones.some((p) => p.number?.trim())) ||
        (deferredDraft.emails && deferredDraft.emails.some((e) => e.address?.trim())) ||
        deferredDraft.cnic?.trim()),
  );
  const effectiveCount = hasCandidateKey ? duplicateCount : 0;

  useEffect(() => {
    if (!hasCandidateKey) {
      return;
    }

    const abortController = new AbortController();

    const timer = setTimeout(async () => {
      try {
        // The tag property is a computed frontend-only UI state added by normalization
        const { tag: _tag, ...cleanDraft } = deferredDraft as Record<string, unknown>;
        const res = await apiContract.contacts.duplicateCheck({
          body: { contact: cleanDraft },
          fetchOptions: { signal: abortController.signal },
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) {
          return;
        }
        if (res.status === 200) {
          const body = res.body as { matchCount?: number } | undefined;
          setDuplicateCount(body?.matchCount ?? 0);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        // Non-blocking duplicate check: ignore gracefully
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [hasCandidateKey, deferredDraft]);

  return effectiveCount;
}
