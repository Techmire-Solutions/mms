import { useMemo } from "react";
import type { Contact } from "@mms/contracts";
import { computeContactsSelectionTargets } from "@/tenant/features/contacts/hooks/contactsSelectionTargets";

export function useContactsSelectionTargets({
  selected,
  workContacts,
}: {
  selected: Array<string | number>;
  workContacts: Contact[];
}): { waTargets: Contact[]; smsReady: Contact[]; emailReady: Contact[] } {
  return useMemo(
    () =>
      computeContactsSelectionTargets({
        selectedIds: selected,
        workContacts,
      }),
    [selected, workContacts],
  );
}
