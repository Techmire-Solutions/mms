import { describe, expect, it } from "vitest";
import { mapActionStringToAuditType, sanitizeAuditState } from "./auditState.js";

describe("audit kernel", () => {
  it("maps action strings to audit types", () => {
    expect(mapActionStringToAuditType("create")).toBe("CREATE");
    expect(mapActionStringToAuditType("delete")).toBe("DELETE");
  });

  it("sanitizes audit state", () => {
    expect((sanitizeAuditState({ token: "secret", name: "x" }) as { token?: string }).token).toBe(
      "[REDACTED_SECRET]",
    );
  });
});
