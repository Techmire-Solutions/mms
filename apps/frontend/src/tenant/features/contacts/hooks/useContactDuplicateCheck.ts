import { useDeferredValue, useEffect, useState } from "react";
import type { Contact } from "@mms/shared";
import { apiContract } from "@/lib/api";

export interface UseContactDuplicateCheckOptions {
  open: boolean;
  contactId?: string | number;
  contactDraft: Partial<Contact>;
}

/** Identity of the fields the duplicate probe actually queries. */
function contactCandidateSignature(draft: Partial<Contact>): string {
  return JSON.stringify({
    name: draft.name ?? "",
    firstName: draft.firstName ?? "",
    cnic: draft.cnic ?? "",
    phones: (draft.phones ?? []).map((phone) => phone.number ?? "").join("|"),
    emails: (draft.emails ?? []).map((email) => email.address ?? "").join("|"),
  });
}

export function useContactDuplicateCheck({
  open,
  contactId,
  contactDraft,
}: UseContactDuplicateCheckOptions): number {
  const [duplicateResult, setDuplicateResult] = useState<{
    signature: string;
    count: number;
  } | null>(null);
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
  // A result only describes the candidate it was requested for: changing the name
  // (or phone/email/cnic) immediately falls back to 0 instead of a stale count.
  const candidateSignature = contactCandidateSignature(deferredDraft);
  const effectiveCount =
    hasCandidateKey && duplicateResult?.signature === candidateSignature
      ? duplicateResult.count
      : 0;

  useEffect(() => {
    if (!hasCandidateKey) {
      return;
    }

    const abortController = new AbortController();
    const signature = contactCandidateSignature(deferredDraft);

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
          setDuplicateResult({ signature, count: body?.matchCount ?? 0 });
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
