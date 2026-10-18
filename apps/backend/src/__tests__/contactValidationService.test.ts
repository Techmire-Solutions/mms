import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig } from "@mms/shared";

const mockLoadContactFieldConfig = vi.fn();
const mockValidateOrThrow = vi.fn();

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: () => mockLoadContactFieldConfig(),
}));

vi.mock("../lib/zodRequest.js", () => ({
  validateOrThrow: (...args: unknown[]) => mockValidateOrThrow(...args),
}));

import { validateContactDynamic } from "../contacts/use-cases/contactValidationUseCases.js";

function makeFieldConfig(version = 1): FieldConfig {
  return {
    version,
    fields: {},
    formTabs: [],
    enabledTabs: [],
    requiredTabs: [],
  } as unknown as FieldConfig;
}

describe("contactValidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateOrThrow.mockImplementation(() => undefined);
  });

  it("is a no-op when no field config exists", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(null);

    await expect(validateContactDynamic("demo", { name: "Aisha" })).resolves.toBeUndefined();
    expect(mockValidateOrThrow).not.toHaveBeenCalled();
  });

  it("validates a contact through validateOrThrow", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig());

    await expect(validateContactDynamic("demo", { name: "Aisha" })).resolves.toBeUndefined();
    expect(mockValidateOrThrow).toHaveBeenCalled();
  });

  it("rethrows validation errors from validateOrThrow", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig());
    const validationError = new Error("Field name is required");
    mockValidateOrThrow.mockImplementation(() => {
      throw validationError;
    });

    await expect(validateContactDynamic("demo", {})).rejects.toBe(validationError);
  });

  it("throws a blueprint-version-mismatch when _blueprintId differs", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(3));

    await expect(
      validateContactDynamic("demo", { name: "Aisha", _blueprintId: 2 }),
    ).rejects.toThrow(/Blueprint version mismatch/);
    expect(mockValidateOrThrow).not.toHaveBeenCalled();
  });

  it("accepts a matching _blueprintId", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig(3));

    await expect(
      validateContactDynamic("demo", { name: "Aisha", _blueprintId: 3 }),
    ).resolves.toBeUndefined();
    expect(mockValidateOrThrow).toHaveBeenCalled();
  });

  it("validates repeatedly across calls with the same config", async () => {
    mockLoadContactFieldConfig.mockResolvedValue(makeFieldConfig());

    await validateContactDynamic("demo", { name: "A" });
    await validateContactDynamic("demo", { name: "B" });

    expect(mockValidateOrThrow).toHaveBeenCalledTimes(2);
    expect(mockLoadContactFieldConfig).toHaveBeenCalledTimes(2);
  });
});
