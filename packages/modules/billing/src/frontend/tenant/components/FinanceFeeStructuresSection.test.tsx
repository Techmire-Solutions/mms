import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceFeeStructuresSection } from "./FinanceFeeStructuresSection";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  save: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("@mms/fe-core/i18n", async () => {
  const { useTranslationEnMock } = await import("../test/useTranslationEnMock.js");
  return { useTranslation: useTranslationEnMock() };
});

vi.mock("../hooks/useFinanceFeeStructures", () => ({
  useFinanceFeeStructures: () => ({ data: [] }),
  useFinanceFeeStructureMutations: () => ({ save: mocks.save, remove: mocks.remove }),
}));

vi.mock("../host/sessionsCollection", () => ({
  useSessionsCollection: () => [],
}));

vi.mock("../host/SessionClassSectionSelect.js", () => ({
  SessionClassSectionSelect: () => null,
}));

vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("FinanceFeeStructuresSection item amount", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.save.mutateAsync.mockReset().mockResolvedValue({});
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(<FinanceFeeStructuresSection />);
    });
  };

  const input = (id: string) =>
    container.querySelector<HTMLInputElement>(`#${id}`) as HTMLInputElement;

  const clickAdd = async () => {
    const add = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Structure",
    );
    await act(async () => add?.click());
  };

  it("shows an inline error for a named item without a positive amount and never saves", async () => {
    await render();
    await act(async () => {
      setInputValue(input("fee-struct-name"), "Grade 1");
      setInputValue(input("fee-struct-item-name"), "Tuition");
      setInputValue(input("fee-struct-item-amount"), "0");
    });

    await clickAdd();

    expect(container.textContent).toContain("Amount must be greater than zero.");
    expect(mocks.save.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves the parsed amount once the item amount is valid", async () => {
    await render();
    await act(async () => {
      setInputValue(input("fee-struct-name"), "Grade 1");
      setInputValue(input("fee-struct-item-name"), "Tuition");
      setInputValue(input("fee-struct-item-amount"), "25.50");
    });

    await clickAdd();

    expect(mocks.save.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Grade 1",
        items: [expect.objectContaining({ name: "Tuition", amount: 25.5 })],
      }),
    );
  });
});
