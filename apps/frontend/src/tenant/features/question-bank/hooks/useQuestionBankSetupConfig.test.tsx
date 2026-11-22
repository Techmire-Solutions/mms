import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_QUESTION_BANK_SETTINGS } from "@mms/shared";

const mutationSpies = vi.hoisted(() => ({
  updateFields: vi.fn(async () => ({ body: {} })),
  updatePrefs: vi.fn(async () => ({ body: {} })),
}));

vi.mock("@/lib/api", () => ({
  tsrClient: {
    questionBank: {
      getComposedConfig: {
        useQuery: () => ({
          data: { body: DEFAULT_QUESTION_BANK_SETTINGS },
          isLoading: false,
          isError: false,
        }),
      },
      updateFieldConfig: {
        // Mirrors TanStack: `mutateAsync` is the observer's bound `mutate` and stays stable.
        useMutation: () => ({ mutateAsync: mutationSpies.updateFields }),
      },
      updatePreferences: {
        useMutation: () => ({ mutateAsync: mutationSpies.updatePrefs }),
      },
    },
  },
}));

import { useComposedQuestionBankSettings } from "./useQuestionBankSetupConfig";

type ComposedResult = ReturnType<typeof useComposedQuestionBankSettings>;

describe("useComposedQuestionBankSettings", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let current: ComposedResult;

  function Host({ tick }: { tick: number }): React.JSX.Element {
    current = useComposedQuestionBankSettings();
    return <span data-tick={tick} />;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient();

    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <Host tick={0} />
        </QueryClientProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps updateAsync identity stable across unrelated re-renders", () => {
    const first = current.updateAsync;

    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <Host tick={1} />
        </QueryClientProvider>,
      );
    });

    expect(current.updateAsync).toBe(first);
  });
});
