import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeStudentsSettings } from "@mms/shared";
import { ApiError } from "@/lib/apiError";
import { useStudentsSetupSaveActions } from "@/tenant/features/students/hooks/useStudentsSetupSaveActions";

const mocks = vi.hoisted(() => ({
  preferencesMutate: vi.fn(),
  auditMutate: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/safeAudit", () => ({ safeAudit: vi.fn() }));

vi.mock("@/tenant/features/students/hooks/useStudentSetupConfig", () => ({
  useStudentPreferencesMutation: () => ({ mutateAsync: mocks.preferencesMutate }),
}));

vi.mock("@/tenant/features/students/hooks/useStudentMutations", () => ({
  useStudentMutations: () => ({ logSetupAudit: { mutateAsync: mocks.auditMutate } }),
}));

const { notify } = await import("@/lib/notify");

describe("useStudentsSetupSaveActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: ReturnType<typeof useStudentsSetupSaveActions>;
  let setSaved: (value: boolean | ((curr: boolean) => boolean)) => void;

  const settings = normalizeStudentsSettings(null);
  const draft = { ...settings, grNumberDigits: 7 };

  function renderHook(): void {
    function TestComponent() {
      actions = useStudentsSetupSaveActions({ settings, settingsDraft: draft, setSaved });
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    mocks.auditMutate.mockResolvedValue({ status: 200, body: {} });
    setSaved = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    [400, "validation_error"],
    [500, "server_error"],
  ])("does not report success when setup save fails with %i", async (status, type) => {
    mocks.preferencesMutate.mockRejectedValue(new ApiError(status, "Save rejected", type));
    renderHook();

    await act(async () => {
      await actions.handleSave();
    });

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith("students.setup.saveFailed");
    expect(setSaved).not.toHaveBeenCalledWith(true);
  });

  it("reports success and marks saved when the setup save succeeds", async () => {
    mocks.preferencesMutate.mockResolvedValue({ status: 200, body: { preferences: draft } });
    renderHook();

    await act(async () => {
      await actions.handleSave();
    });

    expect(notify.success).toHaveBeenCalledWith("students.setup.preferencesSaved");
    expect(setSaved).toHaveBeenCalledWith(true);
    expect(notify.error).not.toHaveBeenCalled();
  });
});
