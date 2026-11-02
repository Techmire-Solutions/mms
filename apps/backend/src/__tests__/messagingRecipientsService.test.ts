import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact, ContactsListPageResult } from "@mms/shared";

vi.mock("../db/repositories/messagingRepository.js", () => ({
  listMessageTemplatesByWorkspace: vi.fn(),
  findMessageTemplateById: vi.fn(),
  findMessageTemplatesByIds: vi.fn(),
  saveMessageTemplate: vi.fn(),
  bulkSaveMessageTemplates: vi.fn(),
  replaceMessageTemplatesForWorkspace: vi.fn(),
  deleteMessageTemplateById: vi.fn(),
  listMessageLogsByWorkspace: vi.fn(),
  findMessageLogById: vi.fn(),
  findMessageLogsByIds: vi.fn(),
  saveMessageLog: vi.fn(),
  bulkSaveMessageLogs: vi.fn(),
  replaceMessageLogsForWorkspace: vi.fn(),
  insertMessageLogs: vi.fn(),
  queryFilteredMessageLogs: vi.fn(),
  queryMessagingMetrics: vi.fn(),
  softDeleteActiveMessageLogs: vi.fn(),
  restoreArchivedMessageLog: vi.fn(),
  claimMessageLogForDelivery: vi.fn(),
  updateMessageLogDeliveryStatus: vi.fn(),
  deleteMessageLogsByWorkspace: vi.fn(),
}));

const mockLoadContactsPageForTenant = vi.fn();
const mockLoadContactsSummaryByIdsForTenant = vi.fn();
const mockLoadContactFieldConfig = vi.fn();

vi.mock("../services/contactService.js", () => ({
  loadContactsPageForTenant: (...args: unknown[]) => mockLoadContactsPageForTenant(...args),
  loadContactsSummaryByIdsForTenant: (...args: unknown[]) =>
    mockLoadContactsSummaryByIdsForTenant(...args),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: (...args: unknown[]) => mockLoadContactFieldConfig(...args),
}));

import {
  loadMessagingRecipients,
  matchMessagingRecipients,
  resolveMessagingRecipients,
} from "../services/messagingService.js";

function fakeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name: `Contact ${id}`,
    firstName: `Contact`,
    lastName: id,
    relationshipContacts: [],
    relationships: [],
    ...overrides,
  };
}

function pageOf(contacts: Contact[], overrides: Partial<ContactsListPageResult> = {}) {
  return {
    contacts,
    total: contacts.length,
    page: 1,
    limit: 50,
    hasMore: false,
    ...overrides,
  } satisfies ContactsListPageResult;
}

describe("messaging recipient resolvers (contacts use-case seam)", () => {
  beforeEach(() => {
    mockLoadContactsPageForTenant.mockReset();
    mockLoadContactsSummaryByIdsForTenant.mockReset();
    mockLoadContactFieldConfig.mockReset().mockResolvedValue(null);
  });

  it("resolveMessagingRecipients converts survivors via the summary loader", async () => {
    mockLoadContactsSummaryByIdsForTenant.mockResolvedValue([
      fakeContact("a", {
        phones: [{ label: "Mobile", countryCode: "+92", number: "3001234567", isPrimary: true }],
      }),
      fakeContact("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }),
      fakeContact("b", { emails: [{ label: "Primary", address: "b@example.com" }] }),
    ]);

    const recipients = await resolveMessagingRecipients("Demo", ["a", "gone", "b"], "teacher");
    expect(mockLoadContactsSummaryByIdsForTenant).toHaveBeenCalledWith("demo", ["a", "gone", "b"]);
    expect(recipients.map((r) => r.id)).toEqual(["a", "b"]);
    expect(recipients[0]).toMatchObject({ name: "Contact a", phone: "+92 3001234567" });
    expect(recipients[1]).toMatchObject({ name: "Contact b", email: "b@example.com" });
  });

  it("resolveMessagingRecipients returns [] for empty input without touching the use case", async () => {
    expect(await resolveMessagingRecipients("demo", [])).toEqual([]);
    expect(mockLoadContactsSummaryByIdsForTenant).not.toHaveBeenCalled();
  });

  it("loadMessagingRecipients maps role and reachability onto the list query", async () => {
    mockLoadContactsPageForTenant.mockResolvedValue(pageOf([fakeContact("a")], { page: 2 }));

    await loadMessagingRecipients(
      "demo",
      {
        role: "students",
        gender: "male",
        search: "ali",
        page: 2,
        pageSize: 25,
        hasPhone: true,
        hasEmail: undefined,
      },
      "teacher",
    );
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith("demo", {
      page: 2,
      limit: 25,
      search: "ali",
      gender: "male",
      hasPhone: true,
      moduleLinkFilter: "students",
      recipientProjection: true,
    });
  });

  it("returns lean recipients only — no notes, DOB or addresses (A-01)", async () => {
    mockLoadContactsPageForTenant.mockResolvedValue(
      pageOf([
        fakeContact("a", {
          notes: "private note",
          dob: "1990-01-01",
          cnic: "12345-6789012-3",
          phones: [{ label: "Mobile", number: "3001111", isPrimary: true }],
          emails: [{ label: "Primary", address: "a@example.com" }],
          addresses: [{ line1: "1 Street", city: "Lahore" }],
        } as Partial<Contact>),
      ]),
    );

    const result = await loadMessagingRecipients(
      "demo",
      {
        role: "all",
        gender: "all",
        page: 1,
        pageSize: 50,
        hasPhone: undefined,
        hasEmail: undefined,
      },
      "teacher",
    );
    expect(result).toMatchObject({ total: 1, page: 1, limit: 50, hasMore: false });
    expect(result.recipients).toHaveLength(1);
    expect(Object.keys(result.recipients[0]).sort()).toEqual(["email", "id", "name", "phone"]);
    expect(result.recipients[0]).not.toHaveProperty("notes");
    expect(result.recipients[0]).not.toHaveProperty("addresses");
  });

  it("drops a channel hidden by the viewer's contact field config (A-02)", async () => {
    mockLoadContactFieldConfig.mockResolvedValue({
      version: 1,
      enabledTabs: [],
      requiredTabs: [],
      fields: {
        phones: [
          {
            key: "number",
            label: "Phone",
            type: "text",
            enabled: true,
            order: 0,
            permissions: ["admin"],
          },
        ],
        emails: [
          {
            key: "address",
            label: "Email",
            type: "email",
            enabled: true,
            order: 0,
            permissions: ["admin"],
          },
        ],
      },
    });
    mockLoadContactsPageForTenant.mockResolvedValue(
      pageOf([
        fakeContact("a", {
          phones: [{ label: "Mobile", number: "3001111", isPrimary: true }],
          emails: [{ label: "Primary", address: "a@example.com" }],
        }),
      ]),
    );

    const visible = await loadMessagingRecipients(
      "demo",
      {
        role: "all",
        gender: "all",
        page: 1,
        pageSize: 50,
        hasPhone: undefined,
        hasEmail: undefined,
      },
      "teacher",
    );
    expect(visible.recipients[0]).toMatchObject({ id: "a", phone: "", email: "" });

    const phoneRequired = await loadMessagingRecipients(
      "demo",
      { role: "all", gender: "all", page: 1, pageSize: 50, hasPhone: true, hasEmail: undefined },
      "teacher",
    );
    expect(phoneRequired.recipients).toHaveLength(0);

    const adminView = await loadMessagingRecipients(
      "demo",
      { role: "all", gender: "all", page: 1, pageSize: 50, hasPhone: true, hasEmail: undefined },
      "admin",
    );
    expect(adminView.recipients).toHaveLength(1);
  });

  it("loadMessagingRecipients uses unlinked filter for the contacts role", async () => {
    mockLoadContactsPageForTenant.mockResolvedValue(pageOf([]));

    await loadMessagingRecipients("demo", {
      role: "contacts",
      gender: "all",
      page: 1,
      pageSize: 50,
      hasPhone: undefined,
      hasEmail: undefined,
    });
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ moduleLinkFilter: "unlinked" }),
    );
  });

  it("loadMessagingRecipients falls back to hasReachable and no role filter", async () => {
    mockLoadContactsPageForTenant.mockResolvedValue(pageOf([]));

    await loadMessagingRecipients("demo", {
      role: "all",
      gender: "all",
      page: 1,
      pageSize: 50,
      hasPhone: undefined,
      hasEmail: undefined,
    });
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ hasReachable: true, recipientProjection: true }),
    );
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith(
      "demo",
      expect.not.objectContaining({ moduleLinkFilter: expect.anything() }),
    );
  });

  it("matchMessagingRecipients stops on the final page and reports truncation", async () => {
    mockLoadContactsPageForTenant.mockResolvedValue(
      pageOf(
        [
          fakeContact("a", { phones: [{ label: "Mobile", number: "3001111" }] }),
          fakeContact("b", { phones: [{ label: "Mobile", number: "3002222" }] }),
        ],
        { total: 900, limit: 500, hasMore: false },
      ),
    );

    const result = await matchMessagingRecipients(
      "demo",
      { role: "all", gender: "all", kind: "phone" },
      "teacher",
    );
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ page: 1, limit: 500, hasPhone: true }),
    );
    expect(result.recipients).toHaveLength(2);
    expect(result.total).toBe(900);
    expect(result.truncated).toBe(true);
  });

  it("matchMessagingRecipients pages until hasMore is false", async () => {
    const makePage = (page: number, ids: string[]): ContactsListPageResult =>
      pageOf(
        ids.map((id) =>
          fakeContact(id, { emails: [{ label: "Primary", address: `${id}@example.com` }] }),
        ),
        { page, limit: 500, hasMore: page === 1 },
      );
    mockLoadContactsPageForTenant
      .mockResolvedValueOnce(makePage(1, ["a", "b"]))
      .mockResolvedValueOnce(makePage(2, ["c", "d"]));

    const result = await matchMessagingRecipients(
      "demo",
      { role: "all", gender: "all", kind: "email" },
      "teacher",
    );
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledTimes(2);
    expect(result.recipients.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.truncated).toBe(false);
  });
});
