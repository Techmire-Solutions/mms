import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
}));

const { recordModernAuditEvent } = await import("../services/auditTrailService.js");
const { auditContactBulkTagged, auditContactMerged, auditContactPersisted, auditContactUpdated } =
  await import("../contacts/use-cases/contactWriteAudit.js");

const record = vi.mocked(recordModernAuditEvent);

describe("contactWriteAudit", () => {
  beforeEach(() => {
    record.mockClear();
  });

  it("records a create with subject scoping and the session actor", async () => {
    await auditContactPersisted({
      tenant: "demo",
      contactId: "c-1",
      actorId: "u-1",
      created: true,
      restored: false,
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceSubdomain: "demo",
        tableName: "contacts",
        recordId: "c-1",
        actionType: "CREATE",
        realUserId: "u-1",
        subjectId: "c-1",
        newState: expect.objectContaining({ action: "contact.create" }),
      }),
    );
  });

  it("records an upsert as UPDATE and a resurrection as RESTORE", async () => {
    await auditContactPersisted({
      tenant: "demo",
      contactId: "c-1",
      created: false,
      restored: false,
    });
    await auditContactPersisted({
      tenant: "demo",
      contactId: "c-1",
      created: false,
      restored: true,
    });

    expect(record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ actionType: "UPDATE", subjectId: "c-1" }),
    );
    expect(record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ actionType: "RESTORE", subjectId: "c-1" }),
    );
  });

  it("records an update with the contact subject", async () => {
    await auditContactUpdated({ tenant: "demo", contactId: "c-2", actorId: "u-2" });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "UPDATE",
        recordId: "c-2",
        realUserId: "u-2",
        subjectId: "c-2",
        newState: expect.objectContaining({ action: "contact.update" }),
      }),
    );
  });

  it("records a merge against the survivor with the archived contact named", async () => {
    await auditContactMerged({
      tenant: "demo",
      keepId: "c-keep",
      deleteId: "c-delete",
      actorId: "u-3",
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "UPDATE",
        recordId: "c-keep",
        realUserId: "u-3",
        subjectId: "c-keep",
        newState: expect.objectContaining({
          action: "contact.merge",
          archivedContactId: "c-delete",
        }),
      }),
    );
  });

  it("records a bulk tag edit per contact with the applied diff", async () => {
    await auditContactBulkTagged({
      tenant: "demo",
      contactId: "c-4",
      actorId: "u-4",
      addedTags: ["English"],
      removedTags: ["Science"],
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "c-4",
        realUserId: "u-4",
        subjectId: "c-4",
        newState: expect.objectContaining({
          action: "contact.bulk_tag",
          summary: expect.stringContaining("added [English]; removed [Science]"),
        }),
      }),
    );
  });
});
