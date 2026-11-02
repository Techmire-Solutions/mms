import { describe, expect, it } from "vitest";
import { isActiveWindow } from "../contacts/systemTags/contactSystemTagCompute.js";

describe("contact system tag active window", () => {
  const today = "2026-11-03";

  it("treats an open-ended role as active", () => {
    expect(isActiveWindow(null, null, today)).toBe(true);
    expect(isActiveWindow("2026-11-03", null, today)).toBe(true);
  });

  it("keeps future starts and past ends inactive", () => {
    expect(isActiveWindow("2026-11-04", null, today)).toBe(false);
    expect(isActiveWindow(null, "2026-11-02", today)).toBe(false);
  });

  it("uses the supplied workspace-local day for the boundary", () => {
    expect(isActiveWindow("2026-11-03", "2026-11-03", today)).toBe(true);
    expect(isActiveWindow("2026-11-03", "2026-11-03", "2026-11-02")).toBe(false);
  });
});
