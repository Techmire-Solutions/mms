import { describe, expect, it, vi } from "vitest";

const mockLoadSummary = vi.fn();
const mockLoadFieldConfig = vi.fn();

vi.mock("../services/contactService.js", () => ({
  loadContactsSummaryByIdsForTenant: (...args: unknown[]) => mockLoadSummary(...args),
}));
vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: (...args: unknown[]) => mockLoadFieldConfig(...args),
}));

import {
  loadSanitizedReminderContacts,
  reminderRecipient,
} from "../finance/use-cases/financeCollectRecipients.js";

describe("financeCollectRecipients", () => {
  it("loads summary contacts, filters soft-deleted, and sanitizes for the viewer role", async () => {
    mockLoadSummary.mockResolvedValue([
      { id: "c-1", name: "Parent One", phones: [{ number: "+1234567890", isPrimary: true }] },
      { id: "c-2", name: "Archived", deletedAt: "2026-01-01", phones: [] },
    ]);
    mockLoadFieldConfig.mockResolvedValue({
      fields: {},
      formTabs: [{ key: "phones", label: "Phones", enabled: false, order: 0 }],
    });

    const map = await loadSanitizedReminderContacts("demo", ["c-1", "c-2"], "accountant");

    expect(mockLoadSummary).toHaveBeenCalledWith("demo", ["c-1", "c-2"]);
    expect(map.has("c-1")).toBe(true);
    expect(map.has("c-2")).toBe(false); // soft-deleted contact filtered out
    expect(map.get("c-1")?.phones).toBeUndefined(); // phones tab disabled → sanitized
  });

  it("returns an empty map for an empty id list without loading", async () => {
    const map = await loadSanitizedReminderContacts("demo", [], "accountant");
    expect(map.size).toBe(0);
    expect(mockLoadSummary).not.toHaveBeenCalled();
  });

  it("maps a contact to the lean reminder recipient shape", () => {
    const recipient = reminderRecipient({
      id: "c-1",
      name: "Parent One",
      phones: [{ number: "+1234567890", isPrimary: true }],
      emails: [{ address: "p@test.com", isPrimary: true }],
    } as never);

    expect(recipient.id).toBe("c-1");
    expect(recipient.name).toBe("Parent One");
    expect(recipient.phone).toBeTruthy();
    expect(recipient.email).toBe("p@test.com");
  });
});
