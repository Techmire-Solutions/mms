import { describe, expect, it, vi } from "vitest";
import { safeAudit } from "@/lib/safeAudit";
import { reportClientError } from "@/lib/clientErrorReporting";

vi.mock("@/lib/clientErrorReporting", () => ({
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
