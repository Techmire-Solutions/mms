import { describe, expect, it } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";
import { recordModernAuditEvent } from "../services/auditTrailService.js";

/**
 * The audit chain must never accept a row for another workspace, even if a caller builds one from a
 * cross-tenant id. This is the last line of defence behind the repository predicates and RLS.
 */
describe("recordModernAuditEvent cross-tenant guard", () => {
  it("refuses to append to a workspace other than the request tenant", async () => {
    await expect(
      runWithTenant("demo", () =>
        recordModernAuditEvent({
          workspaceSubdomain: "other-school",
          tableName: "attendance",
          recordId: "att-1",
          actionType: "UPDATE",
          realUserId: "u-admin",
          oldState: { status: "absent" },
          newState: { status: "excused" },
        }),
      ),
    ).rejects.toThrow(/refusing to append to "other-school"/);
  });
});
