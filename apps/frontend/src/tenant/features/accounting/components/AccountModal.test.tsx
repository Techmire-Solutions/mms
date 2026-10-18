import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AccountModal } from "./AccountModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, dir: "ltr", language: "en" }),
}));

vi.mock("@/hooks/useStandardModuleConfig", () => ({
  useAccountingConfig: () => ({
    fields: { code: { required: true }, name: { required: true }, type: { required: true } },
    orderedFields: [
      { id: "code" },
      { id: "type" },
      { id: "name" },
      { id: "subtype" },
      { id: "description" },
    ],
    isFieldEnabled: () => true,
  }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function mount(options: { initial?: unknown; existingCodes?: string[] } = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <AccountModal
        initial={(options.initial ?? null) as never}
        onSave={onSave}
        onClose={onClose}
        existingCodes={options.existingCodes ?? []}
      />,
    );
  });
  return { container, onSave, onClose };
}

async function submit(container: HTMLElement) {
  const form = container.querySelector("form#account-modal-form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("AccountModal", () => {
  it("shows schema validation errors and does not save on empty submit", async () => {
    const { container, onSave } = mount();

    await submit(container);

    expect(container.textContent).toContain("accounting.coa.validation.codeRequired");
    expect(container.textContent).toContain("accounting.coa.validation.nameRequired");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks a new account whose code already exists", async () => {
    const { container, onSave } = mount({ existingCodes: ["1000"] });

    setInputValue(container.querySelector<HTMLInputElement>("#account-code")!, "1000");
    setInputValue(container.querySelector<HTMLInputElement>("#account-name")!, "Cash");
    await submit(container);

    expect(container.textContent).toContain("accounting.coa.validation.codeExists");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves trimmed schema-valid values in edit mode", async () => {
    const initial = {
      id: "a-1",
      code: " 1000 ",
      name: " Cash ",
      type: "Asset",
      subtype: "",
      description: "",
      isActive: true,
    };
    const { container, onSave } = mount({ initial });

    await submit(container);

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved).toMatchObject({ id: "a-1", code: "1000", name: "Cash", type: "Asset" });
  });
});
