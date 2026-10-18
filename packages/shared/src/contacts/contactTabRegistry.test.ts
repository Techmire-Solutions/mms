import { describe, expect, it } from "vitest";
import {
  CONTACT_LEGACY_CUSTOM_FORM_TAB,
  omitContactLegacyCustomFormTabUnlessUsed,
} from "./contactTabRegistry.js";

describe("omitContactLegacyCustomFormTabUnlessUsed", () => {
  it("drops empty retired custom tab", () => {
    const tabs = [
      { key: "basic", label: "Identity", enabled: true, order: 0 },
      { ...CONTACT_LEGACY_CUSTOM_FORM_TAB },
    ];
    expect(omitContactLegacyCustomFormTabUnlessUsed(tabs, {}).map((t) => t.key)).toEqual(["basic"]);
    expect(
      omitContactLegacyCustomFormTabUnlessUsed(tabs, { custom: [] }).map((t) => t.key),
    ).toEqual(["basic"]);
  });

  it("keeps custom when fields remain and normalizes label", () => {
    const tabs = [
      { key: "basic", label: "Identity", enabled: true, order: 0 },
      {
        key: "custom",
        label: "Custom fields",
        enabled: true,
        order: 6,
        isSystem: true,
      },
    ];
    const next = omitContactLegacyCustomFormTabUnlessUsed(tabs, {
      custom: [{ key: "extra", label: "Extra", type: "text", enabled: true, order: 0 }],
    });
    expect(next.map((t) => t.key)).toEqual(["basic", "custom"]);
    expect(next[1]?.label).toBe("Custom");
    expect(next[1]?.labelKey).toBe("contacts.form.tabCustom");
  });
});
