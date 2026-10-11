import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact, FieldConfig } from "@mms/shared";

const mockLoadContactsPage = vi.fn();
const mockLoadContactsByIds = vi.fn();
const mockLoadContactFieldConfig = vi.fn();

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactsPage: (...args: unknown[]) => mockLoadContactsPage(...args),
  loadContactsByIds: (...args: unknown[]) => mockLoadContactsByIds(...args),
}));

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: () => mockLoadContactFieldConfig(),
}));

import { buildContactsCsvExport } from "../services/contactsExportService.js";
import { runWithTenant } from "../lib/tenantContext.js";

function fakeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name: `Contact ${id}`,
    firstName: "Contact",
    lastName: id,
    phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92", isPrimary: true }],
    emails: [{ label: "Primary", address: `${id}@example.com`, isPrimary: true }],
    ...overrides,
  };
}

describe("contactsExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadContactFieldConfig.mockResolvedValue(null);
  });

  it("builds a CSV with default columns when none are passed", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [fakeContact("c1", { firstName: "Aisha", lastName: "Khan", name: "Aisha Khan" })],
      total: 1,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await buildContactsCsvExport({ search: "aisha" }, { viewerRole: "teacher" });

    expect(result.filename).toBe("contacts.csv");
    expect(result.count).toBe(1);
    expect(result.csv).toContain('"First Name","Last Name"');
    expect(result.csv).toContain("Aisha");
    // Sanitization skipped when no field config exists.
    expect(mockLoadContactsPage).toHaveBeenCalledWith(
      expect.objectContaining({ search: "aisha", page: 1, limit: 100 }),
    );
  });

  it("honors explicit columns through viewer filtering", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [fakeContact("c1")],
      total: 1,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await buildContactsCsvExport(
      {},
      {
        viewerRole: "teacher",
        columns: [
          { id: "name", label: "Full Name" },
          { id: "phone", label: "Primary Phone" },
        ],
      },
    );

    expect(result.csv).toContain('"Full Name","Primary Phone"');
  });

  it("strips includeDeleted from the query when allowDeleted is false", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [],
      total: 0,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    await buildContactsCsvExport(
      { includeDeleted: "true" as never, search: "ali" },
      { viewerRole: "teacher" },
    );

    expect(mockLoadContactsPage).toHaveBeenCalledWith(
      expect.not.objectContaining({ includeDeleted: true }),
    );
  });

  it("keeps includeDeleted when allowDeleted is true", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [],
      total: 0,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    await buildContactsCsvExport(
      { includeDeleted: "true" as never },
      { viewerRole: "admin", allowDeleted: true },
    );

    expect(mockLoadContactsPage).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
  });

  it("routes selection exports through loadContactsByIds", async () => {
    mockLoadContactsByIds.mockResolvedValueOnce([fakeContact("c1"), fakeContact("c2")]);

    const result = await buildContactsCsvExport(
      { includeIds: ["c1", "c2"] },
      { viewerRole: "teacher" },
    );

    expect(result.count).toBe(2);
    expect(mockLoadContactsByIds).toHaveBeenCalledWith(["c1", "c2"]);
    expect(mockLoadContactsPage).not.toHaveBeenCalled();
  });

  it("paginates until hasMore is false", async () => {
    mockLoadContactsPage
      .mockResolvedValueOnce({
        contacts: [fakeContact("c1")],
        total: 2,
        page: 1,
        limit: 100,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        contacts: [fakeContact("c2")],
        total: 2,
        page: 2,
        limit: 100,
        hasMore: false,
      });

    const result = await buildContactsCsvExport({}, { viewerRole: "teacher" });

    expect(result.count).toBe(2);
    expect(mockLoadContactsPage).toHaveBeenCalledTimes(2);
  });

  it("uses a custom filename when provided", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [],
      total: 0,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await buildContactsCsvExport(
      {},
      { viewerRole: "teacher", filename: "  ali-export.csv  " },
    );

    expect(result.filename).toBe("ali-export.csv");
  });

  it("sanitizes contact rows for the viewer when a field config exists", async () => {
    const fieldConfig = {
      version: 1,
      fields: {},
      formTabs: [],
      enabledTabs: [],
      requiredTabs: [],
    } as unknown as FieldConfig;
    mockLoadContactFieldConfig.mockResolvedValue(fieldConfig);
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [fakeContact("c1", { firstName: "Aisha", lastName: "Khan", name: "Aisha Khan" })],
      total: 1,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await buildContactsCsvExport({}, { viewerRole: "teacher" });

    expect(result.count).toBe(1);
    expect(result.csv).toContain("Aisha");
    expect(mockLoadContactFieldConfig).toHaveBeenCalled();
  });

  it("prepends active tenant name to export filename", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [],
      total: 0,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await runWithTenant("al-huda", () =>
      buildContactsCsvExport({}, { viewerRole: "teacher" }),
    );

    expect(result.filename).toBe("al-huda_contacts.csv");
  });

  it("exports custom fields and custom tabs when field config is present", async () => {
    const fieldConfig = {
      version: 1,
      fields: {
        basic: [
          {
            key: "bloodGroup",
            label: "Blood Group",
            type: "text",
            enabled: true,
            order: 8,
            required: false,
          },
        ],
      },
      formTabs: [{ key: "custom_medical", label: "Medical History", enabled: true, order: 10 }],
      enabledTabs: ["basic", "custom_medical"],
      requiredTabs: ["basic"],
    } as unknown as FieldConfig;
    mockLoadContactFieldConfig.mockResolvedValue(fieldConfig);
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [
        fakeContact("c1", {
          firstName: "Fatima",
          bloodGroup: "O+",
          custom_medical: [{ allergy: "Penicillin" }],
        } as Partial<Contact>),
      ],
      total: 1,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await buildContactsCsvExport({}, { viewerRole: "admin" });

    expect(result.count).toBe(1);
    expect(result.csv).toContain('"Blood Group"');
    expect(result.csv).toContain('"Medical History"');
    expect(result.csv).toContain("O+");
  });
});
