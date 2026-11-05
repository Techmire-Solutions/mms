import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentsSettings } from "@mms/shared";
import { useStudentFormActionHandlers } from "@/tenant/features/students/hooks/useStudentFormActionHandlers";

const mocks = vi.hoisted(() => ({
  runFlow: vi.fn(),
  confirmPending: vi.fn(),
  notifyError: vi.fn(),
  reportClientError: vi.fn(),
}));

vi.mock("@/tenant/features/students/hooks/studentFormSaveFlow", () => ({
  runStudentSaveFlow: (...args: unknown[]) => mocks.runFlow(...args),
  confirmPendingStudentSave: (...args: unknown[]) => mocks.confirmPending(...args),
}));

vi.mock("@/tenant/features/students/hooks/studentFormHandlers", () => ({
  resolveStudentGrForSave: vi.fn((_student, draft: unknown) => draft),
  buildContactSelectPatch: vi.fn((id: unknown) => ({ contactId: String(id) })),
}));

vi.mock("@/lib/notify", () => ({
  notify: { error: (...args: unknown[]) => mocks.notifyError(...args) },
}));

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: (...args: unknown[]) => mocks.reportClientError(...args),
}));

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    student: null,
    studentDraft: { contactId: "cnt-1", grNumber: "GR-001", status: "active" },
    linkedContact: { id: "cnt-1", name: "Zayd Harith", firstName: "Zayd" },
    nextGrNumber: "GR-002",
    autoGenerateId: true,
    settings: { version: 3 } as unknown as StudentsSettings,
    enabledTabs: new Set(["basic"]),
    language: "en",
    t: ((key: string) => key) as unknown as (key: string) => string,
    onSave: vi.fn(),
    onClose: vi.fn(),
    updateDraft: vi.fn(),
    updateContact: { mutateAsync: vi.fn() },
    pendingSaveData: null,
    typedDuplicateReason: null,
    validationErrors: [],
    setValidationErrors: vi.fn(),
    setSaving: vi.fn(),
    setPendingSaveData: vi.fn(),
    setTypedDuplicateReason: vi.fn(),
    setDuplicateConfirmOpen: vi.fn(),
    formInstanceId: "inst-1",
    onBaselineReset: vi.fn(),
    ...overrides,
  } as unknown as Parameters<typeof useStudentFormActionHandlers>[0];
}

describe("useStudentFormActionHandlers", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: ReturnType<typeof useStudentFormActionHandlers>;

  function renderHook(props = baseProps()): void {
    function TestComponent() {
      actions = useStudentFormActionHandlers(props);
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("always clears the saving latch, even when the save flow aborts early", async () => {
    // Simulates the F-02 failure path: the flow returns false without calling setSaving(false).
    mocks.runFlow.mockResolvedValue(false);
    const props = baseProps();
    renderHook(props);

    let result: boolean | undefined;
    await act(async () => {
      result = await actions.handleSave();
    });

    expect(result).toBe(false);
    expect(props.setSaving).toHaveBeenLastCalledWith(false);
  });

  it("swallows a second save while the first is still running", async () => {
    let release: (value: boolean) => void = () => undefined;
    mocks.runFlow.mockImplementation(() => new Promise<boolean>((resolve) => (release = resolve)));
    renderHook();

    let first: Promise<boolean> | undefined;
    let second: boolean | undefined;
    await act(async () => {
      first = actions.handleSave();
      second = await actions.handleSave();
      release(true);
      await first;
    });

    expect(second).toBe(false);
    expect(mocks.runFlow).toHaveBeenCalledTimes(1);
  });

  it("passes the duplicate prompt state through the dialog handler", () => {
    const props = baseProps();
    renderHook(props);

    act(() => {
      actions.handleDuplicateDialogOpenChange(false);
    });

    expect(props.setDuplicateConfirmOpen).toHaveBeenCalledWith(false);
    expect(props.setTypedDuplicateReason).toHaveBeenCalledWith(null);
    expect(props.setPendingSaveData).toHaveBeenCalledWith(null);
  });

  it("confirms a pending duplicate save through the shared flow", () => {
    const props = baseProps({ pendingSaveData: { contactId: "cnt-1" } });
    renderHook(props);

    act(() => {
      actions.confirmDuplicateSave();
    });

    expect(mocks.confirmPending).toHaveBeenCalledWith(
      expect.objectContaining({ pendingSaveData: { contactId: "cnt-1" }, onSave: props.onSave }),
    );
  });

  it("applies the contact patch to the draft when a contact is selected", () => {
    const props = baseProps();
    renderHook(props);

    act(() => {
      actions.handleContactSelect("cnt-9");
    });

    expect(props.updateDraft).toHaveBeenCalledWith({ contactId: "cnt-9" });
  });

  it("saves the avatar through the contact mutation and reports failures", async () => {
    const props = baseProps();
    vi.mocked(props.updateContact.mutateAsync).mockRejectedValueOnce(new Error("boom"));
    renderHook(props);

    await act(async () => {
      await actions.handleStudentAvatarChange("https://cdn/avatar.png");
    });

    expect(props.updateContact.mutateAsync).toHaveBeenCalledWith({
      id: "cnt-1",
      contact: expect.objectContaining({ id: "cnt-1", avatar: "https://cdn/avatar.png" }),
    });
    expect(mocks.notifyError).toHaveBeenCalledWith("students.saveFailed", undefined);
    expect(mocks.reportClientError).toHaveBeenCalledWith(expect.any(Error), {
      scope: "students.avatar_update",
    });
  });

  it("skips the avatar update when no contact is linked", async () => {
    const props = baseProps({ linkedContact: null });
    renderHook(props);

    await act(async () => {
      await actions.handleStudentAvatarChange("https://cdn/avatar.png");
    });

    expect(props.updateContact.mutateAsync).not.toHaveBeenCalled();
  });

  it("derives the duplicate and validation summaries for the form chrome", () => {
    renderHook(
      baseProps({
        typedDuplicateReason: "grNumber",
        validationErrors: [{ fieldId: "grNumber", message: "duplicate" }],
      }),
    );

    expect(actions.errorSummary).toBe("students.form.duplicateGrNumber");
    expect(actions.validationErrorSummary).toEqual(["duplicate"]);
    expect(actions.duplicateErrorKeys.grNumber).toBe("students.form.duplicateGrNumber");
  });
});
