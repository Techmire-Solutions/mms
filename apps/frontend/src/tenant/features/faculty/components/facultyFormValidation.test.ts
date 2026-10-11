import { describe, expect, it, vi } from "vitest";
import {
  focusFacultyValidationField,
  facultyValidationErrorsByField,
  validateFacultyDraft,
  checkFacultyFormDuplicate,
  DUPLICATE_ERROR_KEYS,
  FACULTY_DUPLICATE_ERROR_KEYS,
} from "./facultyFormValidation";
import * as formAutoScroll from "@/lib/forms/formAutoScroll";
import * as useFacultyModule from "@/tenant/features/faculty/hooks/useFaculty";
import { DEFAULT_FACULTY_SETTINGS } from "@mms/shared";

vi.mock("@/lib/forms/formAutoScroll", () => ({
  scrollAndFocusFirstError: vi.fn(),
}));

vi.mock("@/tenant/features/faculty/hooks/useFaculty", () => ({
  checkFacultyRegistrationDuplicate: vi.fn(),
}));

describe("facultyFormValidation", () => {
  describe("DUPLICATE_ERROR_KEYS", () => {
    it("exposes canonical faculty keys with backward-compatible alias", () => {
      expect(DUPLICATE_ERROR_KEYS.contact).toBe("faculty.form.contactAlreadyFaculty");
      expect(DUPLICATE_ERROR_KEYS.employeeId).toBe("faculty.form.duplicateEmployeeId");
      expect(FACULTY_DUPLICATE_ERROR_KEYS).toBe(DUPLICATE_ERROR_KEYS);
    });
  });

  describe("focusFacultyValidationField", () => {
    it("calls scrollAndFocusFirstError with proper candidate IDs and aliases", () => {
      focusFacultyValidationField("inst-1", "user.role");
      expect(formAutoScroll.scrollAndFocusFirstError).toHaveBeenCalledWith(
        expect.arrayContaining([
          "tf-inst-1-user.role",
          "user.role",
          "faculty-user-role",
          "linked-user-role",
        ]),
        { behavior: "smooth", block: "center" },
      );
    });
  });

  describe("facultyValidationErrorsByField", () => {
    it("maps validation errors by fieldId taking the first error per field", () => {
      const errors = [
        { fieldId: "name", message: "Name is required", tabId: "basic" },
        { fieldId: "name", message: "Name is too short", tabId: "basic" },
        { fieldId: "employeeId", message: "Employee ID is required", tabId: "basic" },
      ];

      const mapped = facultyValidationErrorsByField(errors);
      expect(mapped).toEqual({
        name: "Name is required",
        employeeId: "Employee ID is required",
      });
    });
  });

  describe("checkFacultyFormDuplicate", () => {
    it("delegates to checkFacultyRegistrationDuplicate with trimmed employeeId and string IDs", async () => {
      vi.mocked(useFacultyModule.checkFacultyRegistrationDuplicate).mockResolvedValueOnce(
        "employeeId",
      );

      const result = await checkFacultyFormDuplicate({
        facultyId: "tch-1",
        contactId: "cnt-1",
        employeeId: "  EMP-100  ",
      });

      expect(useFacultyModule.checkFacultyRegistrationDuplicate).toHaveBeenCalledWith({
        excludeId: "tch-1",
        contactId: "cnt-1",
        employeeId: "EMP-100",
      });
      expect(result).toBe("employeeId");
    });
  });

  describe("validateFacultyDraft", () => {
    it("validates valid draft returning null for errors", () => {
      const result = validateFacultyDraft(
        {
          contactId: "cnt-1",
          employeeId: "EMP-001",
          designationId: "des-1",
          employmentStartDate: "2024-01-01",
          status: "active",
        },
        {
          settings: {
            ...DEFAULT_FACULTY_SETTINGS,
            autoGenerateId: false,
            requireContactLink: true,
            defaultSpecialization: "",
          },
          enabledTabs: new Set(["basic", "employment"]),
          fields: {},
          language: "en",
        },
      );

      expect(result).toBeNull();
    });
  });
});
