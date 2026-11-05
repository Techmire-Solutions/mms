import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student, ValidationError } from "@mms/shared";
import { ApiError } from "@/lib/apiError";
import * as formAutoScroll from "@/lib/forms/formAutoScroll";
import {
  checkStudentFormDuplicate,
  prepareStudentForSave,
  validateStudentDraft,
} from "@/tenant/features/students/hooks/studentFormValidation";
import { runStudentSaveFlow } from "@/tenant/features/students/hooks/studentFormSaveFlow";

vi.mock("@/lib/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: vi.fn(),
}));

vi.mock("@/tenant/features/students/hooks/studentFormValidation", () => ({
  validateStudentDraft: vi.fn(),
  checkStudentFormDuplicate: vi.fn(),
  prepareStudentForSave: vi.fn(),
  DUPLICATE_ERROR_KEYS: {
    contact: "students.form.contactAlreadyStudent",
    email: "students.form.duplicateEmail",
    nameDob: "students.form.duplicateNameDob",
    grNumber: "students.form.duplicateGrNumber",
  },
}));

const { notify } = await import("@/lib/notify");

type FlowInput = Parameters<typeof runStudentSaveFlow>[0];

const GR_DUPLICATE_MESSAGE = "students.form.duplicateGrNumber";
const GENERIC_SAVE_FAILED = "students.saveFailed";

function baseInput(overrides: Partial<FlowInput> = {}): FlowInput {
  return {
    studentDraft: { contactId: "cnt-1", grNumber: "GR-001", status: "active" },
    student: null,
    linkedContact: { id: "cnt-1", name: "Zayd Harith", firstName: "Zayd" },
    linkedGenderRaw: "male",
    validationContext: {
      settings: {} as unknown as FlowInput["validationContext"]["settings"],
      fields: {},
      enabledTabs: new Set(["basic", "registration"]),
      requiredTabs: new Set(["basic"]),
      language: "en",
    },
    formInstanceId: "inst-1",
    t: ((key: string) => key) as unknown as FlowInput["t"],
    onSave: vi.fn(),
    onClose: vi.fn(),
    setValidationErrors: vi.fn(),
    setSaving: vi.fn(),
    setPendingSaveData: vi.fn(),
    setTypedDuplicateReason: vi.fn(),
    setDuplicateConfirmOpen: vi.fn(),
    ...overrides,
  };
}

describe("runStudentSaveFlow", () => {
  beforeEach(() => {
    vi.mocked(validateStudentDraft).mockReturnValue(null);
    vi.mocked(checkStudentFormDuplicate).mockResolvedValue(null);
    vi.mocked(prepareStudentForSave).mockImplementation(({ data }) => data as Student);
  });

  it("clears the saving flag after a zod validation error so a retry can save", async () => {
    const zodErrors: ValidationError[] = [
      { fieldId: "grNumber", tabId: "registration", message: "GR number required" },
    ];
    vi.mocked(validateStudentDraft).mockReturnValueOnce(zodErrors);

    const setSaving = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const input = baseInput({ setSaving, onSave });

    const firstAttempt = await runStudentSaveFlow(input);

    expect(firstAttempt).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(setSaving).toHaveBeenLastCalledWith(false);

    const retryAttempt = await runStudentSaveFlow(input);

    expect(retryAttempt).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("treats a 409 with field grNumber as a duplicate GR number", async () => {
    const scrollSpy = vi.spyOn(formAutoScroll, "scrollAndFocusFirstError");
    const setValidationErrors = vi.fn();
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, "Duplicate GR number", "conflict", undefined, [
          { field: "grNumber", message: "This GR number is already assigned" },
        ]),
      );

    const success = await runStudentSaveFlow(baseInput({ setValidationErrors, onSave }));

    expect(success).toBe(false);
    expect(setValidationErrors).toHaveBeenCalledWith([
      {
        fieldId: "grNumber",
        tabId: "registration",
        message: GR_DUPLICATE_MESSAGE,
      },
    ]);
    expect(notify.error).toHaveBeenCalledWith(GR_DUPLICATE_MESSAGE);
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.arrayContaining(["sf-inst-1-grNumber", "grNumber"]),
      { behavior: "smooth", block: "center" },
    );
  });

  it("renders field-level messages from a 400 response", async () => {
    const setValidationErrors = vi.fn();
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, "Invalid student", "validation_error", undefined, [
          { field: "grNumber", message: "GR number has an invalid format" },
        ]),
      );

    const success = await runStudentSaveFlow(baseInput({ setValidationErrors, onSave }));

    expect(success).toBe(false);
    expect(setValidationErrors).toHaveBeenCalledWith([
      {
        fieldId: "grNumber",
        tabId: "registration",
        message: "GR number has an invalid format",
      },
    ]);
    expect(notify.error).toHaveBeenCalledWith(GENERIC_SAVE_FAILED, {
      description: "GR number has an invalid format",
    });
    expect(notify.error).not.toHaveBeenCalledWith(GR_DUPLICATE_MESSAGE);
  });

  it("does not claim a duplicate GR number for a non-GR 409", async () => {
    const setValidationErrors = vi.fn();
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, "Student id already in use", "conflict", undefined, [
          { field: "studentId", message: "Student id already in use" },
        ]),
      );

    const success = await runStudentSaveFlow(baseInput({ setValidationErrors, onSave }));

    expect(success).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(GENERIC_SAVE_FAILED, {
      description: "Student id already in use",
    });
    expect(notify.error).not.toHaveBeenCalledWith(GR_DUPLICATE_MESSAGE);
    for (const call of setValidationErrors.mock.calls) {
      for (const error of call[0] as ValidationError[]) {
        expect(error.fieldId).not.toBe("grNumber");
      }
    }
  });
});
