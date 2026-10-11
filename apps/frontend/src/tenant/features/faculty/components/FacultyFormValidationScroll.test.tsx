import { describe, expect, it, vi, beforeEach } from "vitest";
import { runFacultySaveFlow } from "@/tenant/features/faculty/components/facultyFormSaveFlow";
import * as formAutoScroll from "@/lib/forms/formAutoScroll";
import type { Contact, FacultySettings } from "@mms/shared";

vi.mock("@/lib/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: vi.fn(),
}));

vi.mock("@/tenant/features/faculty/components/facultyFormValidation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/tenant/features/faculty/components/facultyFormValidation")
    >();
  return {
    ...actual,
    validateFacultyDraft: vi.fn(),
    checkFacultyFormDuplicate: vi.fn().mockResolvedValue(null),
  };
});

describe("FacultyForm Validation Auto-Scroll & Contact SSOT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers scrollAndFocusFirstError with smooth center options when validation fails", async () => {
    const scrollSpy = vi.spyOn(formAutoScroll, "scrollAndFocusFirstError");
    const { validateFacultyDraft } =
      await import("@/tenant/features/faculty/components/facultyFormValidation");
    vi.mocked(validateFacultyDraft).mockReturnValue([
      { fieldId: "employeeId", message: "Employee ID is required", tabId: "basic" },
    ]);

    const setErrors = vi.fn();
    const onSave = vi.fn();

    const success = await runFacultySaveFlow({
      facultyDraft: { contactId: "cnt-fac-55" },
      faculty: undefined,
      autoGenerateId: false,
      formInstanceId: "inst-fac-55",
      linkedContact: { id: "cnt-fac-55", name: "Ustadh Bilal" } as Contact,
      settings: {} as FacultySettings,
      enabledTabs: new Set(["basic", "employment"]),
      fields: {},
      language: "en",
      t: ((k: string) =>
        k) as unknown as import("@/lib/contexts/TranslationContext").TranslationFunction,
      onSave,
      onClose: vi.fn(),
      setErrors,
      setSaving: vi.fn(),
      setPendingSaveData: vi.fn(),
      setTypedDuplicateReason: vi.fn(),
      setDuplicateConfirmOpen: vi.fn(),
    });

    expect(success).toBe(false);
    expect(setErrors).toHaveBeenCalledWith({
      employeeId: "Employee ID is required",
    });
    expect(scrollSpy).toHaveBeenCalledWith(
      expect.arrayContaining(["tf-inst-fac-55-employeeId", "employeeId"]),
      { behavior: "smooth", block: "center" },
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("persists contact selection (SSOT) through successful submission", async () => {
    const { validateFacultyDraft } =
      await import("@/tenant/features/faculty/components/facultyFormValidation");
    vi.mocked(validateFacultyDraft).mockReturnValue(null);

    const onSave = vi.fn();
    const onClose = vi.fn();

    const success = await runFacultySaveFlow({
      facultyDraft: {
        contactId: "cnt-fac-88",
        employeeId: "EMP-2026-088",
        status: "active",
        specialization: "Fiqh",
      },
      faculty: undefined,
      autoGenerateId: false,
      formInstanceId: "inst-fac-88",
      linkedContact: {
        id: "cnt-fac-88",
        name: "Ustadh Hamza",
      } as Contact,
      settings: {} as FacultySettings,
      enabledTabs: new Set(["basic", "employment"]),
      fields: {},
      language: "en",
      t: ((k: string) =>
        k) as unknown as import("@/lib/contexts/TranslationContext").TranslationFunction,
      onSave,
      onClose,
      setErrors: vi.fn(),
      setSaving: vi.fn(),
      setPendingSaveData: vi.fn(),
      setTypedDuplicateReason: vi.fn(),
      setDuplicateConfirmOpen: vi.fn(),
    });

    expect(success).toBe(true);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "cnt-fac-88",
        employeeId: "EMP-2026-088",
        status: "active",
        specialization: "Fiqh",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
