import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@mms/shared";

const mockRecordModernAuditEvent = vi.fn().mockResolvedValue({
  hashPrevious: "0".repeat(64),
  hashCurrent: "1".repeat(64),
  canonicalPayload: "{}",
});

vi.mock("../services/auditTrailService.js", () => ({
  recordModernAuditEvent: (...args: unknown[]) => mockRecordModernAuditEvent(...args),
  mapActionStringToAuditType: (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes("create") || lower.includes("add")) return "CREATE";
    if (lower.includes("delete") || lower.includes("remove")) return "DELETE";
    return "UPDATE";
  },
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: vi.fn(() => "demo"),
}));

import { createCollectionAuditHelper } from "../lib/createCollectionAuditHelper.js";

const admin: User = {
  id: "user-1",
  email: "admin@demo.test",
  name: "Admin",
  role: "admin",
  workspaceSubdomain: "demo",
};

describe("createCollectionAuditHelper", () => {
  beforeEach(() => {
    mockRecordModernAuditEvent.mockClear();
  });

  it("records a collection audit entry with the provided args", async () => {
    const auditCollection = createCollectionAuditHelper("contacts");
    await auditCollection(admin, "contacts.delete", "Deleted 3 contacts");

    expect(mockRecordModernAuditEvent).toHaveBeenCalledOnce();
    expect(mockRecordModernAuditEvent).toHaveBeenCalledWith({
      workspaceSubdomain: "demo",
      tableName: "contacts",
      recordId: "contacts",
      actionType: "DELETE",
      realUserId: "user-1",
      newState: { summary: "Deleted 3 contacts", action: "contacts.delete" },
    });
  });

  it("defaults recordId to the factory argument", async () => {
    const auditCollection = createCollectionAuditHelper("faculty");
    await auditCollection(admin, "faculty.delete", "");

    expect(mockRecordModernAuditEvent.mock.calls[0][0]).toMatchObject({
      tableName: "faculty",
      recordId: "faculty",
    });
  });

  it("overrides recordId when a 4th arg is passed", async () => {
    const auditCollection = createCollectionAuditHelper("contacts");
    await auditCollection(admin, "contacts.delete", "", "specific-contact");

    expect(mockRecordModernAuditEvent.mock.calls[0][0]).toMatchObject({
      tableName: "contacts",
      recordId: "specific-contact",
    });
  });
});
