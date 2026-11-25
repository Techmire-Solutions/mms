import { describe, expect, it } from "vitest";
import { useUnsavedChangesGuard } from "@mms/fe-core/hooks";

describe("useUnsavedChangesGuard smoke test", () => {
  it("exports useUnsavedChangesGuard as a function", () => {
    expect(typeof useUnsavedChangesGuard).toBe("function");
  });
});
