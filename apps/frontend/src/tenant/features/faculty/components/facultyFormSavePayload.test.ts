import { describe, expect, it, vi } from "vitest";
import type { Contact, FacultyMember } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  buildFacultySavePayload,
  validateUserDraftRequirements,
  isEmployeeIdConflictError,
} from "./facultyFormSavePayload";
import type { FacultySaveFlowInput } from "./facultyFormSaveFlow";

vi.mock("@/lib/notify", () => ({
  notify: {
    error: vi.fn(),
  },
}));

describe("facultyFormSavePayload", () => {
  describe("buildFacultySavePayload", () => {
    it("builds payload using facultyDraft employeeId and converts contactId to string", () => {
      const payload = buildFacultySavePayload({
        facultyDraft: {
          name: "Ustadh Ahmad",
          employeeId: "EMP-001",
          contactId: "cnt-1",
        },
        autoGenerateId: false,
      });

      expect(payload.name).toBeUndefined();
      expect(payload.employeeId).toBe("EMP-001");
      expect(payload.contactId).toBe("cnt-1");
    });

    it("uses nextEmployeeId when autoGenerateId is true and creating new faculty member", () => {
      const payload = buildFacultySavePayload({
        facultyDraft: {
          name: "Ustadh Ahmad",
          contactId: "cnt-1",
        },
        autoGenerateId: true,
        nextEmployeeId: "EMP-099",
      });

      expect(payload.employeeId).toBe("EMP-099");
    });

    it("strips read projections on update", () => {
      const draft = {
        name: "Ustadh Ahmad",
        contactId: "cnt-1",
        designationAssignableRoles: ["admin"],
        designationEndsOn: "2026-12-31",
        department: "Academics",
        reportingFacultyId: "sup-1",
        contact: { id: "cnt-1" } as Contact,
        subordinates: [],
      } as unknown as Partial<FacultyMember>;

      const payload = buildFacultySavePayload({
        facultyDraft: draft,
        faculty: { id: "fac-1" } as FacultyMember,
        autoGenerateId: false,
      });

      expect((payload as Record<string, unknown>).designationAssignableRoles).toBeUndefined();
      expect(payload.designationEndsOn).toBeUndefined();
      expect(payload.department).toBeUndefined();
      expect(payload.reportingFacultyId).toBeUndefined();
      expect((payload as Record<string, unknown>).contact).toBeUndefined();
      expect((payload as Record<string, unknown>).subordinates).toBeUndefined();
    });

    it("strips unknown draft keys on create (allowlist only)", () => {
      const payload = buildFacultySavePayload({
        facultyDraft: {
          contactId: "cnt-1",
          designationEndsOn: "2026-12-31",
          designationId: "des-1",
        },
        autoGenerateId: false,
      });

      expect(payload.designationEndsOn).toBeUndefined();
      expect(payload.designationId).toBe("des-1");
    });
  });

  describe("validateUserDraftRequirements", () => {
    const mockT: TranslationFunction = ((key: string, ..._rest: unknown[]) =>
      key) as unknown as TranslationFunction;

    const baseInput: FacultySaveFlowInput = {
      facultyDraft: {},
      formInstanceId: "form-1",
      autoGenerateId: false,
      settings: {} as any,
      enabledTabs: new Set(),
      fields: {},
      language: "en",
      t: mockT,
      onSave: vi.fn(),
      onClose: vi.fn(),
      setErrors: vi.fn(),
      setSaving: vi.fn(),
      setPendingSaveData: vi.fn(),
      setTypedDuplicateReason: vi.fn(),
      setDuplicateConfirmOpen: vi.fn(),
    };

    it("returns true when user account creation is not enabled", () => {
      expect(validateUserDraftRequirements(baseInput)).toBe(true);
    });

    it("fails when email is missing from linked contact", () => {
      const setErrors = vi.fn();
      const result = validateUserDraftRequirements({
        ...baseInput,
        setErrors,
        userAccountDraft: { enabled: true, setupMethod: "password", role: "staff" },
        linkedContact: { id: "cnt-1" } as Contact,
      });

      expect(result).toBe(false);
      expect(setErrors).toHaveBeenCalledWith(
        expect.objectContaining({ "user.email": "faculty.form.noEmailWarning" }),
      );
    });

    it("fails when role is missing", () => {
      const setErrors = vi.fn();
      const result = validateUserDraftRequirements({
        ...baseInput,
        setErrors,
        userAccountDraft: { enabled: true, setupMethod: "password", role: "" },
        linkedContact: { id: "cnt-1", emails: [{ address: "test@example.com" }] } as any,
      });

      expect(result).toBe(false);
      expect(setErrors).toHaveBeenCalledWith(
        expect.objectContaining({ "user.role": "users.errorRoleRequired" }),
      );
    });

    it("fails when password is too short", () => {
      const setErrors = vi.fn();
      const result = validateUserDraftRequirements({
        ...baseInput,
        setErrors,
        userAccountDraft: {
          enabled: true,
          setupMethod: "password",
          role: "staff",
          password: "short",
        },
        linkedContact: { id: "cnt-1", emails: [{ address: "test@example.com" }] } as any,
      });

      expect(result).toBe(false);
      expect(setErrors).toHaveBeenCalledWith(
        expect.objectContaining({ "user.password": "auth.passwordCheckLength" }),
      );
    });

    it("passes when valid email, role, and password are provided", () => {
      const result = validateUserDraftRequirements({
        ...baseInput,
        userAccountDraft: {
          enabled: true,
          setupMethod: "password",
          role: "staff",
          password: "securepassword123",
        },
        linkedContact: { id: "cnt-1", emails: [{ address: "test@example.com" }] } as any,
      });

      expect(result).toBe(true);
    });
  });

  describe("isEmployeeIdConflictError", () => {
    it("detects employeeId conflict errors", () => {
      expect(isEmployeeIdConflictError(new Error("Duplicate employeeId found"))).toBe(true);
      expect(isEmployeeIdConflictError(new Error("duplicate_employee"))).toBe(true);
      expect(
        isEmployeeIdConflictError({
          errors: [{ fieldId: "employeeId", message: "Employee ID must be unique" }],
        }),
      ).toBe(true);
      expect(isEmployeeIdConflictError(new Error("Generic network failure"))).toBe(false);
    });
  });
});
