import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { FacultyMember } from "@mms/contracts";
import { ApiError } from "@/lib/apiError";
import { useFacultyFormSaveActions } from "./useFacultyFormSaveActions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  reportClientError: vi.fn(),
  runFacultySaveFlow: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    error: (...args: unknown[]) => mocks.notifyError(...args),
    warning: (...args: unknown[]) => mocks.notifyWarning(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: (...args: unknown[]) => mocks.reportClientError(...args),
}));

vi.mock("@/tenant/hooks/collections/users", () => ({
  invalidateUsersQueries: vi.fn(),
}));

// Exercise the real `confirmPendingFacultySave`; only the initial save flow is
// stubbed so it can reach the duplicate-confirm state without a full record.
vi.mock("@/tenant/features/faculty/lib/facultyFormSaveFlow", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/tenant/features/faculty/lib/facultyFormSaveFlow")>();
  return {
    ...actual,
    runFacultySaveFlow: (...args: Parameters<typeof actual.runFacultySaveFlow>) =>
      mocks.runFacultySaveFlow(...args),
  };
});

type HookResult = ReturnType<typeof useFacultyFormSaveActions>;
type HookInput = Parameters<typeof useFacultyFormSaveActions>[0];

const pendingDraft = { contactId: "c1", employeeId: "EMP-9" } as Partial<FacultyMember>;

function baseProps(overrides: Partial<HookInput> = {}): HookInput {
  return {
    facultyDraft: { contactId: "c1" },
    faculty: undefined,
    autoGenerateId: false,
    formInstanceId: "form-1",
    linkedContact: null,
    settings: {} as HookInput["settings"],
    enabledTabs: new Set<string>(),
    fieldsMap: {},
    language: "en",
    t: ((key: string) => key) as unknown as TranslationFunction,
    onSave: vi.fn(async () => undefined),
    onClose: vi.fn(),
    setBaselineSnapshot: vi.fn(),
    userAccountDraft: { enabled: false } as HookInput["userAccountDraft"],
    linkedUser: null,
    queryClient: {} as QueryClient,
    ...overrides,
  };
}

describe("useFacultyFormSaveActions confirmDuplicateSave", () => {
  let container: HTMLDivElement;
  let root: Root;
  let result: HookResult;

  function renderHook(props = baseProps()): void {
    function TestComponent() {
      result = useFacultyFormSaveActions(props);
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.runFacultySaveFlow.mockReset();
    mocks.runFacultySaveFlow.mockImplementation(
      async (input: {
        setPendingSaveData: (data: Partial<FacultyMember>) => void;
        setDuplicateConfirmOpen: (open: boolean) => void;
      }) => {
        input.setPendingSaveData(pendingDraft);
        input.setDuplicateConfirmOpen(true);
        return false;
      },
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function seedPendingDuplicate(props: HookInput): Promise<void> {
    renderHook(props);
    await act(async () => {
      await result.handleSave();
    });
    expect(result.pendingSaveData).toEqual(pendingDraft);
    expect(result.duplicateConfirmOpen).toBe(true);
  }

  it("runs two synchronous confirms as a single save", async () => {
    let release: (value: undefined) => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await seedPendingDuplicate(baseProps({ onSave }));

    let first: Promise<boolean> | undefined;
    let second: boolean | undefined;
    await act(async () => {
      first = result.confirmDuplicateSave();
      second = await result.confirmDuplicateSave();
      release(undefined);
      await first;
    });

    expect(second).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("keeps the pending draft and the dialog open, and maps the failure into errors", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, "Invalid faculty", "validation_error", undefined, [
          { field: "employeeId", message: "Employee ID is already taken" },
        ]),
      );
    await seedPendingDuplicate(baseProps({ onSave }));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.confirmDuplicateSave();
    });

    expect(saved).toBe(false);
    expect(mocks.notifyError).toHaveBeenCalled();
    // Retry must still have the draft and an open confirm dialog…
    expect(result.pendingSaveData).toEqual(pendingDraft);
    expect(result.duplicateConfirmOpen).toBe(true);
    // …and the server field error must land on the form.
    expect(result.errors).toEqual({ employeeId: "Employee ID is already taken" });
    expect(result.validationErrorSummary).toContain("Employee ID is already taken");

    // Clearing employeeId error removes it from errors
    act(() => {
      result.clearEmployeeIdError();
    });
    expect(result.errors.employeeId).toBeUndefined();
  });
});
