import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_QUESTION_BANK_SETTINGS } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./useQuestionBankSetupConfig", () => ({
  useComposedQuestionBankSettings: () => ({
    data: DEFAULT_QUESTION_BANK_SETTINGS,
    updateAsync: async () => undefined,
  }),
}));

import { useQuestionBankConfig, type QuestionBankConfig } from "./useQuestionBankConfig";

const questions = [{ categoryIds: ["fiqh"] }] as never;
let current: QuestionBankConfig;

// One component type across renders so the hook instance (and its memo cells) survives.
function Host({ tick }: { tick: number }): React.JSX.Element {
  current = useQuestionBankConfig(questions);
  return <span data-tick={tick} />;
}

describe("useQuestionBankConfig memoization", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Host tick={0} />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("returns stable derived references across an unrelated re-render", () => {
    const categories = current.categories;
    const orderedFields = current.orderedFields;
    const enabledTypes = current.enabledQuestionTypes;

    act(() => root.render(<Host tick={1} />));

    expect(current.categories).toBe(categories);
    expect(current.orderedFields).toBe(orderedFields);
    expect(current.enabledQuestionTypes).toBe(enabledTypes);
  });
});
