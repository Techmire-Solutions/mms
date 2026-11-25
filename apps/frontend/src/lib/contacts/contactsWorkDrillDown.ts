import { createModuleWorkDrillDown } from "@/lib/query/createModuleWorkDrillDown";
import type { ContactsWorkDrillDown } from "@mms/contracts";

export type { ContactsWorkDrillDown };

export const CONTACTS_WORK_DRILLDOWN_EVENT = "contacts-work-drilldown";

const { apply, consume } = createModuleWorkDrillDown<ContactsWorkDrillDown>({
  event: CONTACTS_WORK_DRILLDOWN_EVENT,
  storageKey: "mms_contacts_work_drilldown",
});

export function applyContactsWorkDrillDown(filter: ContactsWorkDrillDown): void {
  apply(filter);
}

export function consumeContactsWorkDrillDown(): ContactsWorkDrillDown | null {
  return consume();
}
