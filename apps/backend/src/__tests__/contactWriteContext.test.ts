import { describe, expect, it, vi } from "vitest";

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: vi.fn().mockResolvedValue({
    fields: { basic: [] },
    formTabs: [],
  }),
}));

vi.mock("../contacts/use-cases/contactLookupsService.js", () => ({
  loadContactLookupKind: vi.fn().mockResolvedValue([
    { country: "PK", code: "+92" },
    { country: "US", code: "+1" },
  ]),
}));

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactRuntimeDefaults: vi.fn().mockResolvedValue({
    defaultPhoneCountryCode: "+92",
    phoneLabel: "Mobile",
    emailLabel: "Personal",
  }),
}));

import { loadContactWriteContext } from "../contacts/use-cases/contactWriteContext.js";
import type { ContactWriteContext } from "../contacts/use-cases/contactWriteContextTypes.js";

describe("loadContactWriteContext", () => {
  it("loads runtime defaults, country codes, and field config in parallel", async () => {
    const context: ContactWriteContext = await loadContactWriteContext();

    expect(context.runtimeDefaults.defaultPhoneCountryCode).toBe("+92");
    expect(context.countryCodes).toHaveLength(2);
    expect(context.fieldConfig?.fields).toBeDefined();
  });
});
