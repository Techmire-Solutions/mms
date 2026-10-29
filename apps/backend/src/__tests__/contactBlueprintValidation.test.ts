import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig, TabDefinition } from "@mms/shared";
import { validateContactDynamic } from "../contacts/use-cases/contactBlueprintValidation.js";
import { loadContactFieldConfig } from "../contacts/use-cases/contactConfigService.js";

vi.mock("../contacts/use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: vi.fn(),
}));

const TENANT = "tenant-contacts";

type ContactFieldConfigWithTabs = FieldConfig & { formTabs: TabDefinition[] };

function createValidFieldConfig(version = 1): ContactFieldConfigWithTabs {
  return {
    version,
    enabledTabs: ["basic"],
    requiredTabs: ["basic"],
    fields: {
      basic: [
        {
          key: "name",
          label: "Full Name",
          type: "text",
          enabled: true,
          order: 1,
          required: true,
        },
        {
          key: "email",
          label: "Email",
          type: "email",
          enabled: true,
          order: 2,
          required: false,
        },
      ],
    },
    formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 1 }],
  };
}

describe("contactBlueprintValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given no active field configuration, should return early without throwing", async () => {
    // Arrange
    vi.mocked(loadContactFieldConfig).mockResolvedValue(null);
    const contact = { name: "Ahmad" };

    // Act & Assert
    await expect(validateContactDynamic(TENANT, contact)).resolves.toBeUndefined();
    expect(loadContactFieldConfig).toHaveBeenCalledTimes(1);
  });

  it("given mismatched blueprint version, should reject with version conflict error", async () => {
    // Arrange
    vi.mocked(loadContactFieldConfig).mockResolvedValue(createValidFieldConfig(2));
    const contact = {
      _blueprintId: 1,
      name: "Ahmad",
    };

    // Act & Assert
    await expect(validateContactDynamic(TENANT, contact)).rejects.toThrow(
      "Blueprint version mismatch. Expected version 2, got 1. Please reload the form.",
    );
  });

  it("given matching blueprint version and valid contact fields, should validate successfully", async () => {
    // Arrange
    vi.mocked(loadContactFieldConfig).mockResolvedValue(createValidFieldConfig(1));
    const contact = {
      _blueprintId: 1,
      name: "Ahmad Zahid",
      email: "ahmad@example.com",
    };

    // Act & Assert
    await expect(validateContactDynamic(TENANT, contact)).resolves.toBeUndefined();
  });

  it("given array of valid contact records, should validate all records without throwing", async () => {
    // Arrange
    vi.mocked(loadContactFieldConfig).mockResolvedValue(createValidFieldConfig(1));
    const contacts = [
      { name: "Contact One", email: "one@example.com" },
      { name: "Contact Two", email: "two@example.com" },
    ];

    // Act & Assert
    await expect(validateContactDynamic(TENANT, contacts)).resolves.toBeUndefined();
  });

  it("given contact record missing required field, should throw validation error", async () => {
    // Arrange
    vi.mocked(loadContactFieldConfig).mockResolvedValue(createValidFieldConfig(1));
    const contact = {
      _blueprintId: 1,
      email: "missing-name@example.com",
    };

    // Act & Assert
    await expect(validateContactDynamic(TENANT, contact)).rejects.toThrow();
  });

  it("given repeated calls with identical config, should cache compiled schema and validate cleanly", async () => {
    // Arrange
    const config = createValidFieldConfig(3);
    vi.mocked(loadContactFieldConfig).mockResolvedValue(config);
    const contactA = { _blueprintId: 3, name: "First Person" };
    const contactB = { _blueprintId: 3, name: "Second Person" };

    // Act
    await validateContactDynamic(TENANT, contactA, "en", "admin");
    await validateContactDynamic(TENANT, contactB, "en", "admin");

    // Assert
    expect(loadContactFieldConfig).toHaveBeenCalledTimes(2);
  });
});
