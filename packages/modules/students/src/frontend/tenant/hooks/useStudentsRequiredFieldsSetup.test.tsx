import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeStudentsSettings,
  setStudentFieldRequired,
  type FieldDefinition,
  type StudentsSettings,
} from "@mms/contracts";
import { useStudentsRequiredFieldsSetup } from "./useStudentsRequiredFieldsSetup";

const mocks = vi.hoisted(() => ({
  fieldConfigMutate: vi.fn(),
  auditMutate: vi.fn(),
  query: {
    data: undefined as StudentsSettings | undefined,
    isSuccess: true,
    isPlaceholderData: false,
    isError: false,
  },
}));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("@mms/fe-core/lib/safeAudit", () => ({ safeAudit: vi.fn() }));

vi.mock("./useStudentSetupConfig", () => ({
  useStudentFieldConfigQuery: () => mocks.query,
  useStudentFieldConfigMutation: () => ({ mutateAsync: mocks.fieldConfigMutate }),
}));

vi.mock("./useStudentMutations", () => ({
  useStudentMutations: () => ({ logSetupAudit: { mutateAsync: mocks.auditMutate } }),
}));

const { notify } = await import("@mms/fe-core/notify");

function requiredOf(config: StudentsSettings, key: string): boolean | undefined {
  return Object.values(config.fields as Record<string, FieldDefinition[]>)
    .flat()
    .find((field) => field.key === key)?.required;
}

describe("useStudentsRequiredFieldsSetup", () => {
  let container: HTMLDivElement;
  let root: Root;
  let state: ReturnType<typeof useStudentsRequiredFieldsSetup>;

  function renderHook(): void {
    function TestComponent() {
      state = useStudentsRequiredFieldsSetup();
      return null;
    }
    act(() => {
      root.render(<TestComponent />);
    });
  }

  beforeEach(() => {
    const saved = normalizeStudentsSettings(null);
    mocks.query = {
      data: {
        ...saved,
        fields: setStudentFieldRequired(
          saved.fields as Record<string, FieldDefinition[]>,
          "dob",
          false,
        ),
      },
      isSuccess: true,
      isPlaceholderData: false,
      isError: false,
    };
    mocks.fieldConfigMutate.mockImplementation(async (config: StudentsSettings) => config);
    mocks.auditMutate.mockResolvedValue({ status: 200, body: {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("given DOB is optional in the saved Setup, should show it off with a clean draft", () => {
    // Arrange / Act
    renderHook();

    // Assert
    expect(state.isDirty).toBe(false);
    expect(state.rows.find((row) => row.key === "dob")?.required).toBe(false);
  });

  it("given a recommended field is toggled on, should save it as required", async () => {
    // Arrange
    renderHook();

    // Act
    act(() => state.setRequired("dob", true));
    await act(async () => {
      await state.save();
    });

    // Assert
    expect(mocks.fieldConfigMutate).toHaveBeenCalledTimes(1);
    const sent = mocks.fieldConfigMutate.mock.calls[0][0] as StudentsSettings;
    expect(requiredOf(sent, "dob")).toBe(true);
    expect(requiredOf(sent, "contactId")).toBe(true);
    expect(notify.success).toHaveBeenCalledWith("students.setup.requiredFieldsSaved");
  });

  it("given a single toggle, should persist that field and keep others", async () => {
    // Arrange
    renderHook();

    // Act — education defaults on (recommended), so turning it off is the edit.
    act(() => state.setRequired("education", false));
    await act(async () => {
      await state.save();
    });

    // Assert
    const sent = mocks.fieldConfigMutate.mock.calls[0][0] as StudentsSettings;
    expect(requiredOf(sent, "education")).toBe(false);
    expect(requiredOf(sent, "gender")).toBe(true);
  });

  it("given the saved config has not loaded yet, should block edits and saves", async () => {
    // Arrange
    mocks.query = { ...mocks.query, isPlaceholderData: true };
    renderHook();

    // Act
    act(() => state.setRequired("education", true));
    await act(async () => {
      await state.save();
    });

    // Assert
    expect(state.ready).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(mocks.fieldConfigMutate).not.toHaveBeenCalled();
  });

  it("given the save fails, should keep the draft and show an error", async () => {
    // Arrange
    mocks.fieldConfigMutate.mockRejectedValue(new Error("boom"));
    renderHook();

    // Act
    act(() => state.setRequired("education", false));
    await act(async () => {
      await state.save();
    });

    // Assert
    expect(notify.error).toHaveBeenCalledWith("students.setup.saveFailed");
    expect(state.isDirty).toBe(true);
  });

  it("lists phone/email as off-by-default contact checks and omits gender", () => {
    // Arrange / Act
    renderHook();

    // Assert
    expect(state.rows.map((row) => row.key)).toEqual([
      "dob",
      "contactRelationships",
      "address",
      "education",
      "phone",
      "email",
    ]);
    expect(state.rows.find((row) => row.key === "phone")).toMatchObject({
      required: false,
      recommended: false,
    });
    expect(state.rows.find((row) => row.key === "email")).toMatchObject({
      required: false,
      recommended: false,
    });
  });

  it("saves an enabled phone contact-detail check without touching email", async () => {
    // Arrange
    renderHook();

    // Act
    act(() => state.setRequired("phone", true));
    await act(async () => {
      await state.save();
    });

    // Assert
    const sent = mocks.fieldConfigMutate.mock.calls[0][0] as StudentsSettings;
    expect(requiredOf(sent, "phone")).toBe(true);
    expect(requiredOf(sent, "email")).toBe(false);
  });
});
