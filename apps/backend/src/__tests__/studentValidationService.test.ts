import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectStudentDynamicIssues,
  validateStudentDynamic,
} from "../services/studentValidationService.js";

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  loadContacts: vi.fn(),
}));

vi.mock("../students/use-cases/studentConfigService.js", () => ({
  loadStudentsSettingsCombined: (...args: unknown[]) => mocks.loadSettings(...args),
}));

vi.mock("../services/contactService.js", () => ({
  loadContactsSummaryByIdsForTenant: (...args: unknown[]) => mocks.loadContacts(...args),
}));

interface FieldSeed {
  key: string;
  label?: string;
  type?: string;
  enabled?: boolean;
  required?: boolean;
  order?: number;
}

function settings(fields: FieldSeed[], version = 3) {
  return {
    version,
    enabledTabs: ["basic"],
    requiredTabs: ["basic"],
    formTabs: [{ key: "basic", label: "Basic", enabled: true, order: 0 }],
    fields: { basic: fields },
    columnRegistry: [],
  };
}

// The compiled schema is cached by `tenant:version:language`, so every case that uses a
// different blueprint must carry a different version or it would reuse the first schema.
const VERSION = {
  valid: 31,
  requiredCustomField: 32,
  autoGenerateOn: 33,
  autoGenerateOff: 34,
  hydration: 35,
  stale: 7,
  wrapperThrows: 36,
  wrapperResolves: 37,
} as const;

describe("student dynamic validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadContacts.mockResolvedValue([]);
  });

  it("returns no issues when the workspace has no field configuration yet", async () => {
    mocks.loadSettings.mockResolvedValue(null);
    await expect(collectStudentDynamicIssues("demo", { contactId: "c-1" })).resolves.toEqual([]);
  });

  it("accepts a payload that satisfies the enabled blueprint", async () => {
    mocks.loadSettings.mockResolvedValue(
      settings(
        [
          { key: "contactId", type: "text", enabled: true, required: true, order: 0 },
          { key: "grNumber", type: "text", enabled: true, required: true, order: 1 },
          { key: "customNote", type: "text", enabled: true, order: 2 },
        ],
        VERSION.valid,
      ),
    );

    await expect(
      collectStudentDynamicIssues("demo", { contactId: "c-1", grNumber: "GR-1" }),
    ).resolves.toEqual([]);
  });

  it("reports the field-level issues for a payload that misses a required Setup field", async () => {
    mocks.loadSettings.mockResolvedValue(
      settings(
        [
          { key: "contactId", type: "text", enabled: true, required: true, order: 0 },
          { key: "guardianPhone", type: "text", enabled: true, required: true, order: 1 },
        ],
        VERSION.requiredCustomField,
      ),
    );

    const issues = await collectStudentDynamicIssues("demo", { contactId: "c-1" });

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((issue) => issue.field)).toContain("guardianPhone");
    for (const issue of issues) {
      expect(typeof issue.message).toBe("string");
      expect(issue.message.length).toBeGreaterThan(0);
    }
  });

  it("requires the GR number only when auto-generation is disabled", async () => {
    const fields = [
      { key: "contactId", type: "text", enabled: true, required: true, order: 0 },
      { key: "grNumber", type: "text", enabled: true, required: true, order: 1 },
    ];

    // Distinct versions: the compiled schema is cached per tenant+version+language.
    mocks.loadSettings.mockResolvedValue({
      ...settings(fields, VERSION.autoGenerateOn),
      autoGenerateId: true,
    });
    await expect(collectStudentDynamicIssues("demo", { contactId: "c-1" })).resolves.toEqual([]);

    mocks.loadSettings.mockResolvedValue({
      ...settings(fields, VERSION.autoGenerateOff),
      autoGenerateId: false,
    });
    const issues = await collectStudentDynamicIssues("demo", { contactId: "c-1" });
    expect(issues.map((issue) => issue.field)).toContain("grNumber");
  });

  it("hydrates the subject from the linked contact before validating", async () => {
    mocks.loadSettings.mockResolvedValue(
      settings(
        [{ key: "contactId", type: "text", enabled: true, required: true, order: 0 }],
        VERSION.hydration,
      ),
    );
    mocks.loadContacts.mockResolvedValue([
      {
        id: "c-1",
        name: "Ali Khan",
        gender: "male",
        dob: "2012-01-01",
        phones: [{ label: "mobile", number: "03001234567", isPrimary: true }],
        emails: [{ label: "work", address: "ali@example.com", isPrimary: true }],
        addresses: [{ label: "home", city: "Lahore" }],
      },
    ]);

    await collectStudentDynamicIssues("demo", { contactId: "c-1" });

    expect(mocks.loadContacts).toHaveBeenCalledWith("demo", ["c-1"]);
  });

  it("rejects a stale blueprint version", async () => {
    mocks.loadSettings.mockResolvedValue(settings([], VERSION.stale));

    await expect(
      collectStudentDynamicIssues("demo", { contactId: "c-1", _blueprintId: 3 }),
    ).rejects.toThrow(/Blueprint version mismatch/i);
  });

  it("keeps validateStudentDynamic as the throwing wrapper over the issue list", async () => {
    mocks.loadSettings.mockResolvedValue(
      settings(
        [
          { key: "contactId", type: "text", enabled: true, required: true, order: 0 },
          { key: "guardianPhone", type: "text", enabled: true, required: true, order: 1 },
        ],
        VERSION.wrapperThrows,
      ),
    );

    // The wrapper throws the joined issue messages (zod's required-field text for this schema).
    await expect(validateStudentDynamic("demo", { contactId: "c-1" })).rejects.toThrow(
      /expected string|required|guardianPhone/i,
    );
  });

  it("resolves validateStudentDynamic for a valid payload", async () => {
    mocks.loadSettings.mockResolvedValue(
      settings(
        [{ key: "contactId", type: "text", enabled: true, required: true, order: 0 }],
        VERSION.wrapperResolves,
      ),
    );

    await expect(
      validateStudentDynamic("demo", { contactId: "c-1", grNumber: "GR-1" }),
    ).resolves.toBeUndefined();
  });
});
