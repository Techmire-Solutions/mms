import { describe, expect, it, vi } from "vitest";
import { safeAudit } from "@mms/fe-core/lib/safeAudit";
import { reportClientError } from "@mms/fe-core/reporting/clientErrorReporting";

vi.mock("@mms/fe-core/reporting/clientErrorReporting", () => ({
  reportClientError: vi.fn(),
}));

describe("safeAudit", () => {
  it("reports a rejected audit promise with its scope", async () => {
    const error = new Error("audit failed");
    safeAudit(Promise.reject(error), "contacts.audit");
    await Promise.resolve();
    await Promise.resolve();
    expect(reportClientError).toHaveBeenCalledWith(error, { scope: "contacts.audit" });
  });

  it("does not report when the audit promise resolves", async () => {
    safeAudit(Promise.resolve(), "contacts.audit");
    await Promise.resolve();
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
