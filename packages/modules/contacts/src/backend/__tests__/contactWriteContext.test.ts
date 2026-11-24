import { describe, expect, it, vi } from "vitest";

vi.mock("../use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: vi.fn().mockResolvedValue({
    fields: { basic: [] },
    formTabs: [],
  }),
}));

vi.mock("../use-cases/contactLoadUseCases.js", () => ({
  loadContactRuntimeDefaults: vi.fn().mockResolvedValue({
    defaultPhoneCountryCode: "+92",
    phoneLabel: "Mobile",
    emailLabel: "Personal",
    countryCodes: [
      { country: "PK", code: "+92" },
      { country: "US", code: "+1" },
    ],
    relationshipPairs: [],
  }),
}));

import { loadContactWriteContext } from "../use-cases/index.js";
import type { ContactWriteContext } from "../use-cases/index.js";

describe("loadContactWriteContext", () => {
  it("loads runtime defaults, country codes, and field config in parallel", async () => {
    const context: ContactWriteContext = await loadContactWriteContext();

    expect(context.runtimeDefaults.defaultPhoneCountryCode).toBe("+92");
    expect(context.countryCodes).toHaveLength(2);
    expect(context.fieldConfig?.fields).toBeDefined();
  });
});
