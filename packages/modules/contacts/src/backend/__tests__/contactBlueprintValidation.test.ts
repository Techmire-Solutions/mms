import { describe, expect, it } from "vitest";
import type { FieldConfig } from "@mms/contracts";
import { ContactBlueprintValidationError, validateContactDynamic } from "../use-cases/index.js";

const fieldConfig: FieldConfig = {
  version: 1,
  fields: {
    basic: [
      {
        key: "firstName",
        label: "First Name",
        type: "text",
        enabled: true,
        order: 0,
        required: true,
        permissions: [],
        defaultValue: "",
      },
    ],
  },
  formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
  requiredTabs: [],
  enabledTabs: [],
};

describe("validateContactDynamic strict allowlist", () => {
  it("rejects unknown top-level keys instead of silently dropping them", async () => {
    await expect(
      validateContactDynamic("demo", { firstName: "Ali", sneaky: 1 }, { fieldConfig }),
    ).rejects.toBeInstanceOf(ContactBlueprintValidationError);
  });

  it("accepts a valid record", async () => {
    await expect(
      validateContactDynamic("demo", { firstName: "Ali" }, { fieldConfig }),
    ).resolves.toBeUndefined();
  });

  it("accepts systemTags (read-only strip-only projection) on the write payload", async () => {
    await expect(
      validateContactDynamic("demo", { firstName: "Ali", systemTags: [] }, { fieldConfig }),
    ).resolves.toBeUndefined();
  });
});
