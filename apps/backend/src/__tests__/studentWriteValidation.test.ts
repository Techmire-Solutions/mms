import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

const mockLoadSettings = vi.fn();
const mockCollectIssues = vi.fn();
const mockGetRequestTenant = vi.fn(() => "demo");

vi.mock("../students/use-cases/studentConfigService.js", () => ({
  loadStudentsSettingsCombined: () => mockLoadSettings(),
}));

vi.mock("../services/studentValidationService.js", () => ({
  collectStudentDynamicIssues: (...args: unknown[]) => mockCollectIssues(...args),
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant(),
}));

import {
  StudentBlueprintConflictError,
  StudentWriteValidationError,
  validateStudentWrite,
} from "../routes/tenant/students/studentWriteValidation.js";

function fakeRequest(acceptLanguage?: string): FastifyRequest {
  return {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
    tenant: { id: "demo" },
  } as unknown as FastifyRequest;
}

function settingsWithFields(keys: string[], version = 3) {
  return {
    version,
    enabledTabs: ["registration"],
    requiredTabs: [],
    formTabs: [],
    fields: {
      registration: keys.map((key) => ({ key, label: key, type: "text", enabled: true })),
    },
  };
}

describe("validateStudentWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSettings.mockResolvedValue(null);
    mockCollectIssues.mockResolvedValue([]);
  });

  it("rejects unknown keys that the Setup registry does not publish", async () => {
    mockLoadSettings.mockResolvedValue(settingsWithFields(["grNumber"]));

    await expect(
      validateStudentWrite(fakeRequest(), { contactId: "c-1", sneaky: "value" }),
    ).rejects.toBeInstanceOf(StudentWriteValidationError);

    await expect(
      validateStudentWrite(fakeRequest(), { contactId: "c-1", sneaky: "value" }),
    ).rejects.toMatchObject({ statusCode: 400, validationErrors: [{ field: "sneaky" }] });
  });

  it("accepts a custom field key that the registry publishes", async () => {
    mockLoadSettings.mockResolvedValue(settingsWithFields(["bloodGroup"]));

    const parsed = await validateStudentWrite(fakeRequest(), {
      contactId: "c-1",
      bloodGroup: "O+",
    });

    expect(parsed.bloodGroup).toBe("O+");
  });

  it("strips client soft-delete metadata before persisting", async () => {
    const parsed = await validateStudentWrite(fakeRequest(), {
      contactId: "c-1",
      deletedAt: "2026-01-01T00:00:00.000Z",
      restoredBy: "someone",
    });

    expect(parsed.deletedAt).toBeUndefined();
    expect((parsed as Record<string, unknown>).restoredBy).toBeUndefined();
  });

  it("returns field-level errors from the tenant blueprint", async () => {
    mockLoadSettings.mockResolvedValue(settingsWithFields(["grNumber"]));
    mockCollectIssues.mockResolvedValue([{ field: "grNumber", message: "GR number is required" }]);

    await expect(validateStudentWrite(fakeRequest(), { contactId: "c-1" })).rejects.toMatchObject({
      statusCode: 400,
      validationErrors: [{ field: "grNumber", message: "GR number is required" }],
    });
  });

  it("rejects a stale blueprint version as a conflict", async () => {
    mockLoadSettings.mockResolvedValue(settingsWithFields(["grNumber"], 7));

    await expect(
      validateStudentWrite(fakeRequest(), { contactId: "c-1", _blueprintId: 5 }),
    ).rejects.toBeInstanceOf(StudentBlueprintConflictError);
  });

  it("skips the blueprint layer when the workspace has no field config", async () => {
    const parsed = await validateStudentWrite(fakeRequest("ar-EG,ar;q=0.9"), { contactId: "c-1" });

    expect(parsed.contactId).toBe("c-1");
    expect(mockCollectIssues).not.toHaveBeenCalled();
  });

  it("passes the request language through to the blueprint validator", async () => {
    mockLoadSettings.mockResolvedValue(settingsWithFields(["grNumber"]));

    await validateStudentWrite(fakeRequest("ur-PK,ur;q=0.9"), { contactId: "c-1" });

    expect(mockCollectIssues).toHaveBeenCalledWith("demo", expect.anything(), "ur");
  });
});
