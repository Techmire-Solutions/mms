import { useContactsByIds } from "@/tenant/hooks/collections/contacts";
import { useUsersByIds } from "@/tenant/hooks/collections/users";
import type { Contact, WorkspaceUser } from "@mms/contracts";

/** Resolve obligation-linked contacts by id (globle2 §10 — no full list fetch). */
export function useMergedObligationContacts(
  ids: (string | number | null | undefined)[],
): Contact[] {
  const { data: linkedContacts = [] } = useContactsByIds(ids);
  return linkedContacts;
}

/** Resolve only users referenced by obligation records. */
export function useMergedObligationUsers(
  ids: (string | number | null | undefined)[],
): WorkspaceUser[] {
  return useUsersByIds(ids).data;
}
