import { describe, expect, it } from "vitest";
import { resolveActiveTab } from "./resolveActiveTab";

const tabs = [{ id: "work" }, { id: "reports" }];

describe("resolveActiveTab", () => {
  it("keeps a tab the role can see", () => {
    expect(resolveActiveTab("reports", tabs)).toBe("reports");
  });

  it("falls back to the first visible tab when the requested one is hidden", () => {
    // `?tab=setup` for a role without configuration.view must not render Setup.
    expect(resolveActiveTab("setup", tabs)).toBe("work");
  });

  it("returns the requested tab when no tabs are known yet", () => {
    expect(resolveActiveTab("setup", [])).toBe("setup");
  });
});
