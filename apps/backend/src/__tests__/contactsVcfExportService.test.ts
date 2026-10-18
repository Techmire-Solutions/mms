import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/shared";

const mockLoadContactsPage = vi.fn();

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactsPage: (...args: unknown[]) => mockLoadContactsPage(...args),
  loadContactsByIds: vi.fn(),
}));

import { buildContactsVcfExport } from "../services/contactsVcfExportService.js";

function fakeContact(id: string): Contact {
  return {
    id,
    name: `Contact ${id}`,
    firstName: "Contact",
    lastName: id,
    phones: [],
    emails: [],
  };
}

describe("contactsVcfExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("joins vCard cards from a single page with CRLF separators", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [fakeContact("c1"), fakeContact("c2")],
      total: 2,
      page: 1,
      limit: 500,
      hasMore: false,
    });

    const result = await buildContactsVcfExport();

    expect(result.count).toBe(2);
    expect(result.filename).toBe("contacts.vcf");
    expect(result.vcf).toContain("BEGIN:VCARD");
    expect(result.vcf).toContain("END:VCARD");
    expect(result.vcf).toMatch(/BEGIN:VCARD\r\nVERSION:3\.0/);
    expect(mockLoadContactsPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 500, includeDeleted: false }),
    );
  });

  it("paginates across multiple pages until hasMore is false", async () => {
    mockLoadContactsPage
      .mockResolvedValueOnce({
        contacts: [fakeContact("c1")],
        total: 2,
        page: 1,
        limit: 500,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        contacts: [fakeContact("c2")],
        total: 2,
        page: 2,
        limit: 500,
        hasMore: false,
      });

    const result = await buildContactsVcfExport();

    expect(result.count).toBe(2);
    expect(mockLoadContactsPage).toHaveBeenCalledTimes(2);
    expect(mockLoadContactsPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("calls onProgress after each page", async () => {
    mockLoadContactsPage
      .mockResolvedValueOnce({
        contacts: [fakeContact("c1")],
        total: 2,
        page: 1,
        limit: 500,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        contacts: [fakeContact("c2")],
        total: 2,
        page: 2,
        limit: 500,
        hasMore: false,
      });

    const onProgress = vi.fn();
    await buildContactsVcfExport({ onProgress });

    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it("uses a trimmed custom filename", async () => {
    mockLoadContactsPage.mockResolvedValueOnce({
      contacts: [],
      total: 0,
      page: 1,
      limit: 500,
      hasMore: false,
    });

    const result = await buildContactsVcfExport({ filename: "  ali.vcf  " });

    expect(result.filename).toBe("ali.vcf");
    expect(result.count).toBe(0);
  });
});
