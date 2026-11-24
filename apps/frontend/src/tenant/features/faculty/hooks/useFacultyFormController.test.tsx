import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyMember } from "@mms/contracts";
import { useFacultyFormController } from "./useFacultyFormController";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  baseRegenerate: vi.fn().mockResolvedValue(undefined),
  clearEmployeeIdError: vi.fn(),
  updateDraft: vi.fn(),
  handleSave: vi.fn().mockResolvedValue(true),
  confirmDuplicateSave: vi.fn().mockResolvedValue(true),
  clearDuplicatePrompt: vi.fn(),
  handleDuplicateDialogOpenChange: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    dir: "ltr",
    language: "en",
  }),
}));

vi.mock("@/tenant/hooks/collections/users", () => ({
  useUsersContractList: () => ({
    data: {
      users: [{ id: "u-1", contactId: "c-1", email: "user1@example.com" }],
    },
  }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useFacultyConfig: () => ({
    settings: {
      idPrefix: "FAC",
      autoGenerateId: true,
      defaultSpecialization: "Quran",
      fields: {},
    },
    isFieldEnabled: (key: string) => key === "enabled_field",
    isFieldRequired: (key: string) => key === "required_field",
  }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyStatusConfig", () => ({
  useFacultyLookupOptions: () => ({
    statusOptions: ["active", "inactive"],
    specializationOptions: ["Quran", "Hadith"],
  }),
  useFacultyStatusConfig: () => ({}),
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyDesignations", () => ({
  useFacultyDesignations: () => ({ data: [{ id: "des-1", title: "Ustadh" }] }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyDepartments", () => ({
  useFacultyDepartments: () => ({ data: [{ id: "dept-1", name: "Arabic" }] }),
  departmentEntitiesToNames: () => ["Arabic"],
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyFormSync", () => ({
  useFacultyAssignableRolesSync: vi.fn(),
}));

vi.mock("@/hooks/useWorkspaceToday", () => ({
  useWorkspaceToday: () => "2026-11-17",
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyDraftState", () => ({
  useFacultyDraftState: () => ({
    facultyDraft: { contactId: "c-1", employeeId: "FAC-26-0001" },
    setBaselineSnapshot: vi.fn(),
    updateDraft: mocks.updateDraft,
    isDirty: false,
    userAccountDraft: { enabled: false },
    setUserAccountDraft: vi.fn(),
    linkedContact: null,
    linkedFacultyContactIds: [],
    nextEmployeeId: "FAC-26-0002",
    isFetchingNextEmployeeId: false,
    handleRegenerateEmployeeId: mocks.baseRegenerate,
  }),
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyFormSaveActions", () => ({
  useFacultyFormSaveActions: () => ({
    saving: false,
    errors: { employeeId: "Duplicate ID", "custom:notes": "Invalid note" },
    handleSave: mocks.handleSave,
    confirmDuplicateSave: mocks.confirmDuplicateSave,
    validationErrorSummary: ["Duplicate ID"],
    pendingSaveData: null,
    typedDuplicateReason: null,
    duplicateConfirmOpen: false,
    clearDuplicatePrompt: mocks.clearDuplicatePrompt,
    clearEmployeeIdError: mocks.clearEmployeeIdError,
    handleDuplicateDialogOpenChange: mocks.handleDuplicateDialogOpenChange,
  }),
}));

type HookResult = ReturnType<typeof useFacultyFormController>;

describe("useFacultyFormController", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
    container = null;
    root = null;
  });

  function renderHook(faculty?: FacultyMember): HookResult {
    let result!: HookResult;
    function TestComponent() {
      result = useFacultyFormController({
        faculty,
        onClose: vi.fn(),
        onSave: vi.fn(),
      });
      return null;
    }
    act(() => {
      root?.render(<TestComponent />);
    });
    return result;
  }

  it("given faculty input, provides full controller state and resolves linked user", () => {
    const controller = renderHook({ id: "fac-1", contactId: "c-1" } as FacultyMember);
    expect(controller.formInstanceId).toBe("fac-1");
    expect(controller.linkedUser?.id).toBe("u-1");
    expect(controller.nextEmployeeId).toBe("FAC-26-0002");
    expect(controller.defaultSpecialization).toBe("Quran");
  });

  it("given regenerate employee id is invoked, should clear employee ID error and trigger base regenerate", async () => {
    const controller = renderHook();
    await act(async () => {
      await controller.handleRegenerateEmployeeId();
    });
    expect(mocks.clearEmployeeIdError).toHaveBeenCalledTimes(1);
    expect(mocks.baseRegenerate).toHaveBeenCalledTimes(1);
  });

  it("given field keys, returns field errors and respects contactId overrides", () => {
    const controller = renderHook();
    expect(controller.getFieldError("employeeId")).toBe("Duplicate ID");
    expect(controller.getFieldError("notes")).toBe("Invalid note");
    expect(controller.getFieldError("specialization")).toBeUndefined();
    expect(controller.isFieldEnabled("contactId")).toBe(true);
    expect(controller.isFieldRequired("contactId")).toBe(true);
    expect(controller.isFieldEnabled("enabled_field")).toBe(true);
    expect(controller.isFieldRequired("required_field")).toBe(true);
  });
});
