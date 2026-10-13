import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultySettings } from "@mms/shared";

const mockLoadFacultySettingsCombined = vi.fn();
const mockValidateOrThrow = vi.fn();
const mockBuildDynamicFacultySchema = vi.fn();

vi.mock("../faculty/use-cases/facultyConfigService.js", () => ({
  loadFacultySettingsCombined: () => mockLoadFacultySettingsCombined(),
}));

vi.mock("../lib/zodRequest.js", () => ({
  validateOrThrow: (...args: unknown[]) => mockValidateOrThrow(...args),
}));

vi.mock("@mms/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/shared")>();
  return {
    ...actual,
    buildDynamicFacultySchema: (...args: unknown[]) => {
      mockBuildDynamicFacultySchema(...args);
      return actual.buildDynamicFacultySchema(
        ...(args as Parameters<typeof actual.buildDynamicFacultySchema>),
      );
    },
  };
});

import { validateFacultyDynamic } from "../services/facultyValidationService.js";

function makeFacultySettings(): FacultySettings {
  return {
    version: 1,
    fields: {},
    formTabs: [],
    enabledTabs: [],
    requiredTabs: [],
  } as unknown as FacultySettings;
}

describe("facultyValidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateOrThrow.mockImplementation(() => undefined);
    mockLoadFacultySettingsCombined.mockResolvedValue(makeFacultySettings());
  });

  it("validates faculty record through validateOrThrow", async () => {
    await expect(validateFacultyDynamic("tenant-a", { contactId: "c-1" })).resolves.toBeUndefined();
    expect(mockValidateOrThrow).toHaveBeenCalled();
    expect(mockLoadFacultySettingsCombined).toHaveBeenCalled();
  });

  it("rethrows validation errors from validateOrThrow", async () => {
    const error = new Error("Invalid faculty record");
    mockValidateOrThrow.mockImplementation(() => {
      throw error;
    });

    await expect(validateFacultyDynamic("tenant-a", {})).rejects.toBe(error);
  });

  it("reuses cached schema for identical tenant, tabs, and fields", async () => {
    await validateFacultyDynamic("tenant-cache", { contactId: "c-1" });
    const initialSchemaBuildCount = mockBuildDynamicFacultySchema.mock.calls.length;

    await validateFacultyDynamic("tenant-cache", { contactId: "c-2" });
    expect(mockBuildDynamicFacultySchema.mock.calls.length).toBe(initialSchemaBuildCount);
    expect(mockValidateOrThrow).toHaveBeenCalledTimes(2);
  });

  it("rebuilds schema when language or tenant differs", async () => {
    await validateFacultyDynamic("tenant-lang", { contactId: "c-1" }, "en");
    const countEn = mockBuildDynamicFacultySchema.mock.calls.length;

    await validateFacultyDynamic("tenant-lang", { contactId: "c-1" }, "ar");
    expect(mockBuildDynamicFacultySchema.mock.calls.length).toBeGreaterThan(countEn);
  });
});
