import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stableBody = {
  questions: [
    {
      id: "q-1",
      categoryIds: ["c-1"],
      type: "short",
      difficulty: "easy",
      questionLanguage: "en",
      text: "A",
      options: [],
      answer: "a",
    },
  ],
};

vi.mock("@mms/fe-core/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@mms/fe-core/api/tsRest", () => ({
  tsrClient: {
    questionBank: {
      listQuestions: {
        useQuery: () => ({ data: { status: 200, body: stableBody } }),
      },
    },
  },
}));

import { useQuestionBankQuestionsCollection } from "./useQuestionBankApi";

describe("useQuestionBankQuestionsCollection", () => {
  let container: HTMLDivElement;
  let root: Root;
  let current: ReturnType<typeof useQuestionBankQuestionsCollection>;

  function Host({ tick }: { tick: number }): React.JSX.Element {
    current = useQuestionBankQuestionsCollection({ enabled: true });
    return <span data-tick={tick} />;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Host tick={0} />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the derived array identity stable across unrelated re-renders", () => {
    const first = current;

    act(() => {
      root.render(<Host tick={1} />);
    });

    // Stable identity matters: the page controller feeds this array into
    // useQuestionBankConfig, whose memo (and everything downstream) depends on it.
    expect(current).toBe(first);
  });
});
