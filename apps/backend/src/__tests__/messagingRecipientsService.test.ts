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
}));

const mockLoadContactsByIdsForTenant = vi.fn();
const mockLoadContactsPageForTenant = vi.fn();

vi.mock("../services/contactService.js", () => ({
  loadContactsByIdsForTenant: (...args: unknown[]) => mockLoadContactsByIdsForTenant(...args),
  loadContactsPageForTenant: (...args: unknown[]) => mockLoadContactsPageForTenant(...args),
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

describe("messaging recipient resolvers (contacts use-case seam)", () => {
  beforeEach(() => {
    mockLoadContactsByIdsForTenant.mockReset();
    mockLoadContactsPageForTenant.mockReset();
  });

  it("resolveMessagingRecipients converts survivors via the tenant read use case", async () => {
    mockLoadContactsByIdsForTenant.mockResolvedValue([
      fakeContact("a", {
        phones: [{ label: "Mobile", countryCode: "+92", number: "3001234567", isPrimary: true }],
      }),
      fakeContact("gone", { deletedAt: "2026-07-27T00:00:00.000Z" }),
      fakeContact("b", { emails: [{ label: "Primary", address: "b@example.com" }] }),
    ]);

    const recipients = await resolveMessagingRecipients("Demo", ["a", "gone", "b"]);
    expect(mockLoadContactsByIdsForTenant).toHaveBeenCalledWith("demo", ["a", "gone", "b"]);
    expect(recipients.map((r) => r.id)).toEqual(["a", "b"]);
    expect(recipients[0]).toMatchObject({ name: "Contact a", phone: "+92 3001234567" });
    expect(recipients[1]).toMatchObject({ name: "Contact b", email: "b@example.com" });
  });

  it("resolveMessagingRecipients returns [] for empty input without touching the use case", async () => {
    expect(await resolveMessagingRecipients("demo", [])).toEqual([]);
    expect(mockLoadContactsByIdsForTenant).not.toHaveBeenCalled();
  });

  it("loadMessagingRecipients maps role and reachability onto the list query", async () => {
    mockLoadContactsPageForTenant.mockResolvedValue({
      contacts: [fakeContact("a")],
      total: 1,
      page: 2,
      limit: 25,
      hasMore: false,
    });

    await loadMessagingRecipients("demo", {
      role: "students",
      gender: "male",
      search: "ali",
      page: 2,
      pageSize: 25,
      hasPhone: true,
      hasEmail: undefined,
    });
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith("demo", {
      page: 2,
      limit: 25,
      search: "ali",
      gender: "male",
      hasPhone: true,
      moduleLinkFilter: "students",
    });
  });

  it("loadMessagingRecipients uses unlinked filter for the contacts role", async () => {
    mockLoadContactsPageForTenant.mockResolvedValue({
      contacts: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });

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
    mockLoadContactsPageForTenant.mockResolvedValue({
      contacts: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });

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
      expect.objectContaining({ hasReachable: true }),
    );
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith(
      "demo",
      expect.not.objectContaining({ moduleLinkFilter: expect.anything() }),
    );
  });

  it("matchMessagingRecipients stops on the final page and reports truncation", async () => {
    const pageResult: ContactsListPageResult = {
      contacts: [
        fakeContact("a", { phones: [{ label: "Mobile", number: "3001111" }] }),
        fakeContact("b", { phones: [{ label: "Mobile", number: "3002222" }] }),
      ],
      total: 900,
      page: 1,
      limit: 500,
      hasMore: false,
    };
    mockLoadContactsPageForTenant.mockResolvedValue(pageResult);

    const result = await matchMessagingRecipients("demo", {
      role: "all",
      gender: "all",
      kind: "phone",
    });
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ page: 1, limit: 500, hasPhone: true }),
    );
    expect(result.recipients).toHaveLength(2);
    expect(result.total).toBe(900);
    expect(result.truncated).toBe(true);
  });

  it("matchMessagingRecipients pages until hasMore is false", async () => {
    const makePage = (page: number, ids: string[]): ContactsListPageResult => ({
      contacts: ids.map((id) => fakeContact(id, { phones: [{ label: "Mobile", number: id }] })),
      total: 4,
      page,
      limit: 2,
      hasMore: page === 1,
    });
    mockLoadContactsPageForTenant
      .mockResolvedValueOnce(makePage(1, ["a", "b"]))
      .mockResolvedValueOnce(makePage(2, ["c", "d"]));

    const result = await matchMessagingRecipients("demo", {
      role: "all",
      gender: "all",
      kind: "email",
    });
    expect(mockLoadContactsPageForTenant).toHaveBeenCalledTimes(2);
    expect(result.recipients.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.truncated).toBe(false);
  });
});
