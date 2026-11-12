import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionFormDraft } from "../lib/questionFormTypes";
import { QuestionFormMcqOptions } from "./QuestionFormMcqOptions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseDraft = {
  id: "q-1",
  categoryIds: ["fiqh"],
  type: "mcq" as const,
  difficulty: "easy" as const,
  questionLanguage: "en" as const,
  text: "Capital?",
  options: ["Cairo", "Giza"],
  answer: "Cairo",
  sourceCitations: [],
};

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("QuestionFormMcqOptions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onChange = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = (options = baseDraft.options, answer = baseDraft.answer) => {
    act(() => {
      root.render(
        <QuestionFormMcqOptions
          questionDraft={{ ...baseDraft, options, answer } as QuestionFormDraft}
          errors={{}}
          onChange={onChange as unknown as (patch: { options?: string[]; answer?: string }) => void}
        />,
      );
    });
  };

  it("adds an option row", () => {
    render();
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "questionBank.addOption",
    );
    act(() => addButton?.click());
    expect(onChange).toHaveBeenCalledWith({ options: ["Cairo", "Giza", ""] });
  });

  it("edits the correct row and carries the selected answer", () => {
    render();
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="text"]');
    act(() => setInputValue(inputs[0]!, "Cairo (Egypt)"));
    expect(onChange).toHaveBeenCalledWith({
      options: ["Cairo (Egypt)", "Giza"],
      answer: "Cairo (Egypt)",
    });
  });

  it("selects the correct option by row index", () => {
    render();
    const radios = container.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    act(() => radios[1]!.click());
    expect(onChange).toHaveBeenCalledWith({ options: ["Cairo", "Giza"], answer: "Giza" });
  });

  it("reorders rows with the move controls", () => {
    render();
    const moveDown = container.querySelector<HTMLButtonElement>(
      'button[aria-label="questionBank.moveOptionDown"]',
    );
    act(() => moveDown?.click());
    expect(onChange).toHaveBeenCalledWith({ options: ["Giza", "Cairo"] });
  });

  it("offers removal only above the two-option floor", () => {
    render();
    expect(container.querySelector('button[aria-label="questionBank.removeOption"]')).toBeNull();

    render(["Cairo", "Giza", "Alexandria"]);
    const remove = container.querySelector<HTMLButtonElement>(
      'button[aria-label="questionBank.removeOption"]',
    );
    act(() => remove?.click());
    // The removed row was the selected answer, so the selection is cleared.
    expect(onChange).toHaveBeenCalledWith({ options: ["Giza", "Alexandria"], answer: "" });
  });
});
