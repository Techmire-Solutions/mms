import { describe, expect, it } from "vitest";
import type { Contact } from "@mms/shared";
import { computeContactsSelectionTargets } from "@/tenant/features/contacts/hooks/contactsSelectionTargets";

function contact(partial: Partial<Contact> & { id: string }): Contact {
  return {
    firstName: "Test",
    lastName: "User",
    ...partial,
  } as Contact;
}

describe("computeContactsSelectionTargets", () => {
  it("returns empty buckets when nothing is selected", () => {
    const result = computeContactsSelectionTargets({
      selectedIds: [],
      workContacts: [contact({ id: "1", phone: "+923001234567" })],
    });
    expect(result).toEqual({ waTargets: [], smsReady: [], emailReady: [] });
  });

  it("filters current-page selected rows by channel eligibility", () => {
    const withPhone = contact({ id: "1", phone: "+923001234567" });
    const withEmail = contact({
      id: "2",
      emails: [{ address: "test@example.com", label: "primary" }],
    });
    const neither = contact({ id: "3" });
    const result = computeContactsSelectionTargets({
      selectedIds: ["1", "2", "3", "missing"],
      workContacts: [withPhone, withEmail, neither],
    });
    expect(result.smsReady.map((row) => row.id)).toEqual(["1"]);
    expect(result.waTargets.map((row) => row.id)).toEqual(["1"]);
    expect(result.emailReady.map((row) => row.id)).toEqual(["2"]);
  });
});
