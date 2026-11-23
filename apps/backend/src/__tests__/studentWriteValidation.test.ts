import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

const mockLoadSettings = vi.fn();
const mockCollectIssues = vi.fn();
const mockGetRequestTenant = vi.fn((): string | undefined => "demo");
const mockLoadContacts = vi.fn();

vi.mock("../students/use-cases/studentConfigService.js", () => ({
  loadStudentsSettingsCombined: () => mockLoadSettings(),
}));

vi.mock("../services/studentValidationService.js", () => ({
  collectStudentDynamicIssues: (...args: unknown[]) => mockCollectIssues(...args),
}));

vi.mock("../contacts/use-cases/contactLoadUseCases.js", () => ({
  loadContactsByIdsForTenant: (...args: unknown[]) => mockLoadContacts(...args),
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
    mockLoadContacts.mockResolvedValue([]);
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

  it("fails closed when the settings read rejects", async () => {
    mockLoadSettings.mockRejectedValue(new Error("settings unavailable"));

    await expect(validateStudentWrite(fakeRequest(), { contactId: "c-1" })).rejects.toThrow(
      "settings unavailable",
    );
    expect(mockCollectIssues).not.toHaveBeenCalled();
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

    expect(mockCollectIssues).toHaveBeenCalledWith(
      "demo",
      expect.anything(),
      "ur",
      expect.anything(),
    );
  });

  it("loads the composed settings once and reuses them for the blueprint check", async () => {
    // m4: validateStudentWrite loaded the settings, then collectStudentDynamicIssues loaded them
    // again — two field-config + preferences reads on every student write.
    const settings = settingsWithFields(["grNumber"]);
    mockLoadSettings.mockResolvedValue(settings);

    await validateStudentWrite(fakeRequest(), { contactId: "c-1" });

    expect(mockLoadSettings).toHaveBeenCalledTimes(1);
    expect(mockCollectIssues).toHaveBeenCalledWith("demo", expect.anything(), "en", settings);
  });

  it("accepts the nested customFields map so a hydrated record can round-trip", async () => {
    // m5: GET emits `customFields`; the strict allowlist rejected it, so GET -> PUT answered 400.
    mockLoadSettings.mockResolvedValue(settingsWithFields(["grNumber"]));

    const parsed = await validateStudentWrite(fakeRequest(), {
      contactId: "c-1",
      grNumber: "GR-1",
      customFields: { nickname: "Aisha" },
    });

    expect(parsed).toMatchObject({ contactId: "c-1", grNumber: "GR-1" });
    expect((parsed as Record<string, unknown>).customFields).toEqual({ nickname: "Aisha" });
  });

  it("fails closed instead of skipping blueprint validation without a tenant", async () => {
    mockLoadSettings.mockResolvedValue(settingsWithFields(["grNumber"]));
    mockGetRequestTenant.mockReturnValue(undefined);
    const request = { headers: {}, tenant: undefined } as unknown as FastifyRequest;

    await expect(validateStudentWrite(request, { contactId: "c-1" })).rejects.toBeInstanceOf(
      StudentWriteValidationError,
    );
  });

  describe("contact-profile requirements", () => {
    function settingsWithRequiredBasicFields(keys: string[]) {
      return {
        version: 9,
        enabledTabs: ["basic", "registration"],
        requiredTabs: [],
        formTabs: [],
        fields: {
          basic: keys.map((key) => ({
            key,
            label: key,
            type: "text",
            enabled: true,
            required: true,
          })),
        },
      };
    }

    it("rejects a linked contact without a required phone or email", async () => {
      mockLoadSettings.mockResolvedValue(settingsWithRequiredBasicFields(["phone", "email"]));
      mockLoadContacts.mockResolvedValue([
        { id: "c-1", name: "Bare", firstName: "Bare", line1: "12 Road" },
      ]);

      await expect(
        validateStudentWrite(fakeRequest(), { contactId: "c-1", grNumber: "GR-1" }),
      ).rejects.toMatchObject({
        type: "validation_error",
        validationErrors: [{ field: "phone" }, { field: "email" }] as never,
      });
      expect(mockLoadContacts).toHaveBeenCalledWith("demo", ["c-1"]);
    });

    it("accepts a contact that carries both values", async () => {
      mockLoadSettings.mockResolvedValue(settingsWithRequiredBasicFields(["phone", "email"]));
      mockLoadContacts.mockResolvedValue([
        {
          id: "c-1",
          name: "Complete",
          firstName: "Complete",
          line1: "12 Road",
          phones: [{ label: "mobile", number: "03001234567" }],
          emails: [{ label: "home", address: "complete@example.com" }],
        },
      ]);

      await expect(
        validateStudentWrite(fakeRequest(), { contactId: "c-1", grNumber: "GR-1" }),
      ).resolves.toMatchObject({ contactId: "c-1" });
    });

    it("skips the contact read when no contact-profile check is required", async () => {
      mockLoadSettings.mockResolvedValue(settingsWithFields(["grNumber"]));

      await expect(
        validateStudentWrite(fakeRequest(), { contactId: "c-1", grNumber: "GR-1" }),
      ).resolves.toBeDefined();
      expect(mockLoadContacts).not.toHaveBeenCalled();
    });
  });
});
