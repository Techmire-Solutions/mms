import { useDeferredValue, useEffect, useState } from "react";
import type { Contact } from "@mms/contracts";
import { apiContract } from "@mms/fe-core/api/tsRest";

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
    lastName: draft.lastName ?? "",
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

  // Runs on create and edit: on edit the contact id is sent so the server excludes
  // the record itself and only other contacts (e.g. a same-name person) count.
  const hasCandidateKey = Boolean(
    open &&
    (deferredDraft.name?.trim() ||
      deferredDraft.firstName?.trim() ||
      deferredDraft.lastName?.trim() ||
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

  // Intentional query-factories exception: this is a debounced, non-blocking
  // transient probe (not cacheable server state), keyed by a candidate signature
  // so a stale count is never shown for a different draft. It mirrors the
  // imperative students duplicate check (`checkStudentRegistrationDuplicate`).
  // A `useQuery` here would populate the shared cache with per-keystroke probe
  // results and still need the same 600ms debounce + abort wiring, so the manual
  // effect is the clearer form for this signal.
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
        const contact = contactId != null ? { ...cleanDraft, id: contactId } : cleanDraft;
        const res = await apiContract.contacts.duplicateCheck({
          body: { contact },
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
  }, [hasCandidateKey, deferredDraft, contactId]);

  return effectiveCount;
}
