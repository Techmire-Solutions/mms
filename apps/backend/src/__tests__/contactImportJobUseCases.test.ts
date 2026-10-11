import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsertContact = vi.fn();
const mockRecordModernAuditEvent = vi.fn();

vi.mock("../contacts/use-cases/contactWriteUseCases.js", () => ({
  upsertContact: (...args: unknown[]) => mockUpsertContact(...args),
}));
vi.mock("../services/auditTrailService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auditTrailService.js")>();
  return {
    ...actual,
    recordModernAuditEvent: (...args: unknown[]) => mockRecordModernAuditEvent(...args),
  };
});

const { buildContactsImportJobLabel, runContactsImportJob } =
  await import("../contacts/use-cases/contactImportJobUseCases.js");

const contacts = (count: number): Array<Record<string, unknown>> =>
  Array.from({ length: count }, (_, index) => ({ firstName: `Contact ${index}` }));

function buildContext(updateProgress = vi.fn().mockResolvedValue(undefined)) {
  return {
    tenant: "demo",
    userId: "u-admin",
    jobId: "job-1",
    updateProgress,
  };
}

describe("runContactsImportJob", () => {
  beforeEach(() => {
    mockUpsertContact.mockReset().mockResolvedValue({ contact: {}, created: true });
    mockRecordModernAuditEvent.mockReset().mockResolvedValue({});
  });

  it("imports every contact and reports progress", async () => {
    const updateProgress = vi.fn().mockResolvedValue(undefined);
    const result = await runContactsImportJob(
      { contacts: contacts(12), viewerRole: "admin" },
      buildContext(updateProgress),
    );

    expect(result).toMatchObject({ imported: 12, failed: 0, total: 12 });
    expect(mockUpsertContact).toHaveBeenCalledTimes(12);
    expect(updateProgress).toHaveBeenCalledWith(0, 12);
    expect(updateProgress).toHaveBeenCalledWith(12, 12);
  });

  it("counts per-contact failures without aborting the batch", async () => {
    mockUpsertContact
      .mockResolvedValueOnce({ created: true })
      .mockRejectedValueOnce(new Error("Duplicate phone number"))
      .mockResolvedValueOnce({ created: true });

    const result = await runContactsImportJob(
      { contacts: contacts(3), viewerRole: "admin" },
      buildContext(),
    );

    expect(result).toMatchObject({ imported: 2, failed: 1, total: 3 });
    expect(result.failures).toEqual(["Duplicate phone number"]);
    expect(mockRecordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        realUserId: "u-admin",
        newState: expect.objectContaining({
          summary: "Imported 2/3 contact(s) (1 failed)",
          action: "contact.import",
        }),
      }),
    );
  });

  it("writes one aggregate audit row for a clean batch", async () => {
    await runContactsImportJob({ contacts: contacts(2), viewerRole: "admin" }, buildContext());

    expect(mockRecordModernAuditEvent).toHaveBeenCalledTimes(1);
    expect(mockRecordModernAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newState: expect.objectContaining({ summary: "Imported 2 contact(s)" }),
      }),
    );
  });

  it("gates soft-delete restoration on the enqueue-time role", async () => {
    await runContactsImportJob({ contacts: contacts(1), viewerRole: "accountant" }, buildContext());
    expect(mockUpsertContact).toHaveBeenCalledWith(expect.anything(), {
      canRestore: false,
      language: "en",
    });

    mockUpsertContact.mockClear();
    await runContactsImportJob({ contacts: contacts(1), viewerRole: "admin" }, buildContext());
    expect(mockUpsertContact).toHaveBeenCalledWith(expect.anything(), {
      canRestore: true,
      language: "en",
    });
  });

  it("does not fail the job when the audit append throws", async () => {
    mockRecordModernAuditEvent.mockRejectedValue(new Error("audit down"));

    const result = await runContactsImportJob(
      { contacts: contacts(1), viewerRole: "admin" },
      buildContext(),
    );

    expect(result.imported).toBe(1);
  });
});

describe("buildContactsImportJobLabel", () => {
  it("summarises a clean and a partial import", () => {
    expect(buildContactsImportJobLabel({ imported: 5, failed: 0, total: 5, failures: [] })).toBe(
      "Imported 5 contacts",
    );
    expect(buildContactsImportJobLabel({ imported: 3, failed: 2, total: 5, failures: [] })).toBe(
      "Imported 3 of 5 contacts (2 failed)",
    );
  });
});
