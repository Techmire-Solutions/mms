import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentForm } from "./StudentForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  handleStudentAvatarChange: vi.fn(async () => undefined),
}));

vi.mock("@/tenant/features/students/hooks/useStudentFormState", () => ({
  useStudentFormState: () => ({
    t: (key: string) => key,
    dir: "ltr",
    language: "en",
    saving: false,
    formError: null,
    isDirty: false,
    handleSave: vi.fn(),
    linkedContact: null,
    studentDraft: { contactId: "cnt-1", grNumber: "GR-101", status: "active" },
    validationErrorSummary: undefined,
    errorSummary: "",
    statusBadgeConfig: {},
    isFieldEnabled: () => false,
    isFieldRequired: () => false,
    getFieldError: () => undefined,
    handleContactSelect: vi.fn(),
    handleStudentAvatarChange: mocks.handleStudentAvatarChange,
    handleGrNumberChange: vi.fn(),
    updateDraft: vi.fn(),
    duplicateConfirmOpen: false,
    handleDuplicateDialogOpenChange: vi.fn(),
    confirmDuplicateSave: vi.fn(),
    duplicateErrorKeys: {},
    formInstanceId: "avatar-form",
    excludeIds: [],
    statusSelectOptions: [],
    fields: {},
  }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/app/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | boolean | Promise<void | boolean>;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="alertdialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            void Promise.resolve(onConfirm()).then((result) => {
              if (result !== false) onOpenChange(false);
            });
          }}
        >
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/tenant/features/students/components/StudentFormTabContent", () => ({
  StudentFormTabContent: ({
    onStudentAvatarChange,
  }: {
    onStudentAvatarChange: (avatarUrl: string) => void;
  }) => (
    <button
      type="button"
      data-testid="avatar-trigger"
      onClick={() => onStudentAvatarChange("https://cdn/avatar.png")}
    >
      pick photo
    </button>
  ),
}));

describe("StudentForm avatar commit", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<StudentForm onClose={vi.fn()} onSave={vi.fn(async () => undefined)} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const trigger = () => {
    const button = container.querySelector("[data-testid='avatar-trigger']");
    if (!(button instanceof HTMLButtonElement)) throw new Error("avatar trigger missing");
    return button;
  };
  const dialog = () => container.querySelector("[role='alertdialog']");
  const dialogButton = (label: string) => {
    const buttons = Array.from(dialog()?.querySelectorAll("button") ?? []);
    const match = buttons.find((button) => button.textContent === label);
    if (!(match instanceof HTMLButtonElement)) throw new Error(`${label} button missing`);
    return match;
  };

  it("makes no contact mutation when the confirmation is cancelled", () => {
    act(() => trigger().click());
    expect(dialog()).not.toBeNull();

    act(() => dialogButton("common.cancel").click());

    expect(dialog()).toBeNull();
    expect(mocks.handleStudentAvatarChange).not.toHaveBeenCalled();
  });

  it("commits exactly one contact photo update on confirm", async () => {
    act(() => trigger().click());

    await act(async () => dialogButton("contacts.form.applyPhoto").click());

    expect(mocks.handleStudentAvatarChange).toHaveBeenCalledTimes(1);
    expect(mocks.handleStudentAvatarChange).toHaveBeenCalledWith("https://cdn/avatar.png");
    expect(dialog()).toBeNull();
  });
});
