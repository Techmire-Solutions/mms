import type { ContactsWorkDrillDown } from "@mms/shared";
import { applyContactsWorkDrillDown } from "@/lib/contacts/contactsWorkDrillDown";

/** Minimal widget shape needed to map Reports/dashboard clicks → Work filters. */
interface ContactsWidgetDrillDownSource {
  collection: string;
  filterField?: string;
  filterValue?: string;
}

/**
 * Map a contacts widget filter to Work directory drill-down.
 * Prefer Work navigation over row-modal drilldown (contacts widgets have no row dump).
 */
export function contactsWidgetToWorkDrillDown(
  widget: ContactsWidgetDrillDownSource,
): ContactsWorkDrillDown | null {
  if (widget.collection !== "contacts") return null;

  const field = widget.filterField?.trim();
  const value = widget.filterValue?.trim();

  if (field === "gender" && value) {
    return { gender: value };
  }
  if (field === "whatsappStatus" && value) {
    return { quickFilter: "whatsapp" };
  }
  if (
    (field === "phone" || field === "email" || field === "phones" || field === "emails") &&
    value
  ) {
    return { quickFilter: "missingInfo" };
  }

  return {};
}

/** Navigate to Contacts Work with filters derived from the widget. */
export function applyContactsWidgetWorkDrillDown(widget: ContactsWidgetDrillDownSource): boolean {
  const drillDown = contactsWidgetToWorkDrillDown(widget);
  if (drillDown === null) return false;
  applyContactsWorkDrillDown(drillDown);
  window.location.assign("/contacts");
  return true;
}
