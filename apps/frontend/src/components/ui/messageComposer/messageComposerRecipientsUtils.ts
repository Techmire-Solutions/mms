import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";
import type { ValidatedMessagingRecipient } from "./useMessageComposerDispatch";
import type { RecipientTab } from "./MessageComposerRecipients";

export function filterDisplayedRecipients(args: {
  recipientTab: RecipientTab;
  recipientSearch: string;
  eligible: ValidatedMessagingRecipient[];
  skipped: ValidatedMessagingRecipient[];
  validated: ValidatedMessagingRecipient[];
}): ValidatedMessagingRecipient[] {
  const list =
    args.recipientTab === "eligible"
      ? args.eligible
      : args.recipientTab === "skipped"
        ? args.skipped
        : args.validated;
  const query = args.recipientSearch.trim().toLowerCase();
  if (!query) return list;
  return list.filter(
    (r) =>
      r.name.toLowerCase().includes(query) ||
      r.phone?.includes(query) ||
      r.email?.toLowerCase().includes(query),
  );
}

export function withAddedRecipient(
  current: MessagingRecipient[],
  candidate: MessagingRecipient,
): { next: MessagingRecipient[]; duplicate: boolean } {
  const duplicate = current.some((r) => String(r.id) === String(candidate.id));
  return {
    duplicate,
    next: duplicate ? current : [...current, candidate],
  };
}
