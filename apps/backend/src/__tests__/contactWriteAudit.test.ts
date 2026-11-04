import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
}));

const { recordModernAuditEvent } = await import("../services/auditTrailService.js");
const { auditContactPersisted, auditContactUpdated } =
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
});
