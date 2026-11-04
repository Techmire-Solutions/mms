import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig } from "@mms/shared";

const mockLoadContactFieldConfig = vi.fn();

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: () => mockLoadContactFieldConfig(),
}));

import { ContactBlueprintValidationError } from "../contacts/use-cases/contactBlueprintValidation.js";
import { validateContactDynamic } from "../contacts/use-cases/contactValidationUseCases.js";

function makeFieldConfig(version = 1, requiredName = false): FieldConfig {
  return {
    version,
    fields: {
      basic: [
        {
          key: "name",
          label: "Full Name",
          type: "text",
          enabled: true,
          order: 1,
          required: requiredName,
        },
      ],
    },
    formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 1 }],
    enabledTabs: ["basic"],
    requiredTabs: [],
  } as unknown as FieldConfig;
}

describe("contactValidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a no-op when no field config exists", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(null);

    await expect(validateContactDynamic("demo", { name: "Aisha" })).resolves.toBeUndefined();
  });

  it("rejects a configured required field that the payload omits as a 400 with field issues", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(1, true));

    const rejection = validateContactDynamic("demo", {});
    await expect(rejection).rejects.toBeInstanceOf(ContactBlueprintValidationError);
    await expect(rejection).rejects.toMatchObject({
      statusCode: 400,
      errors: [expect.objectContaining({ fieldId: "name", tabId: "basic" })],
    });
  });

  it("throws a blueprint-version-mismatch when _blueprintId differs", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(3));

    await expect(
      validateContactDynamic("demo", { name: "Aisha", _blueprintId: 2 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      errors: [expect.objectContaining({ fieldId: "_blueprintId" })],
    });
  });

  it("accepts a matching _blueprintId and a valid payload", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(3, true));

    await expect(
      validateContactDynamic("demo", { name: "Aisha", _blueprintId: 3 }),
    ).resolves.toBeUndefined();
  });

  it("reuses a preloaded field config instead of re-reading it", async () => {
    const config = makeFieldConfig(1, true);

    await validateContactDynamic("demo", { name: "A" }, { fieldConfig: config });
    await validateContactDynamic("demo", { name: "B" }, { fieldConfig: config });

    expect(mockLoadContactFieldConfig).not.toHaveBeenCalled();
  });
});
