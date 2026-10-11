import { describe, expect, it, vi, beforeEach } from "vitest";
import { runStudentSaveFlow } from "@/tenant/features/students/hooks/studentFormSaveFlow";
import * as formAutoScroll from "@/lib/forms/formAutoScroll";
import type { Student, Contact } from "@mms/shared";

vi.mock("@/lib/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: vi.fn(),
}));

vi.mock("@/tenant/features/students/hooks/studentFormValidation", () => ({
  validateStudentDraft: vi.fn(),
  checkStudentFormDuplicate: vi.fn().mockResolvedValue(null),
  prepareStudentForSave: ({ data }: { data: Partial<Student> }) => data as Student,
  DUPLICATE_ERROR_KEYS: {
    grNumber: "students.duplicate.grNumber",
  },
}));

describe("StudentForm Validation Auto-Scroll & Contact SSOT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers scrollAndFocusFirstError with smooth center options when validation fails", async () => {
    const scrollSpy = vi.spyOn(formAutoScroll, "scrollAndFocusFirstError");
    const { validateStudentDraft } =
      await import("@/tenant/features/students/hooks/studentFormValidation");
    vi.mocked(validateStudentDraft).mockReturnValue([
      { fieldId: "grNumber", tabId: "registration", message: "GR number required" },
    ]);

    const setValidationErrors = vi.fn();
    const onSave = vi.fn();

    const success = await runStudentSaveFlow({
      studentDraft: { contactId: "cnt-42" },
      student: null,
      linkedContact: { id: "cnt-42", name: "Fatima Zahra" } as Contact,
      linkedGenderRaw: "female",
      validationContext: {
        settings: {
          requireContactLink: true,
          requireGuardian: false,
          requireGender: false,
          requireDob: false,
        } as any,
        fields: {},
        enabledTabs: new Set(["basic", "registration"]),
        requiredTabs: new Set(["basic"]),
        language: "en",
      },
      formInstanceId: "inst-student-99",
      t: ((k: string) =>
        k) as unknown as import("@/lib/contexts/TranslationContext").TranslationFunction,
      onSave,
      onClose: vi.fn(),
      setValidationErrors,
      setSaving: vi.fn(),
      setPendingSaveData: vi.fn(),
      setTypedDuplicateReason: vi.fn(),
      setDuplicateConfirmOpen: vi.fn(),
    });

    expect(success).toBe(false);
    expect(setValidationErrors).toHaveBeenCalledWith([
      { fieldId: "grNumber", tabId: "registration", message: "GR number required" },
    ]);
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.arrayContaining(["sf-inst-student-99-grNumber", "grNumber"]),
      { behavior: "smooth", block: "center" },
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("persists contact selection (SSOT) through successful submission", async () => {
    const { validateStudentDraft } =
      await import("@/tenant/features/students/hooks/studentFormValidation");
    vi.mocked(validateStudentDraft).mockReturnValue(null);

    const onSave = vi.fn();
    const onClose = vi.fn();

    const success = await runStudentSaveFlow({
      studentDraft: {
        contactId: "cnt-student-101",
        grNumber: "GR-2026-001",
        status: "active",
      },
      student: null,
      linkedContact: {
        id: "cnt-student-101",
        name: "Ibrahim Qasim",
      } as Contact,
      linkedGenderRaw: "male",
      validationContext: {
        settings: {} as any,
        fields: {},
        enabledTabs: new Set(["basic", "registration"]),
        requiredTabs: new Set(["basic"]),
        language: "en",
      },
      formInstanceId: "inst-student-101",
      t: ((k: string) =>
        k) as unknown as import("@/lib/contexts/TranslationContext").TranslationFunction,
      onSave,
      onClose,
      setValidationErrors: vi.fn(),
      setSaving: vi.fn(),
      setPendingSaveData: vi.fn(),
      setTypedDuplicateReason: vi.fn(),
      setDuplicateConfirmOpen: vi.fn(),
    });

    expect(success).toBe(true);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "cnt-student-101",
        grNumber: "GR-2026-001",
        status: "active",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
