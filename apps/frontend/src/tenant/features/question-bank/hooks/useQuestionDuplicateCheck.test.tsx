import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  apiContract: {
    questionBank: {
      checkQuestionDuplicates: checkSpy,
    },
  },
}));

import { useQuestionDuplicateCheck, type DuplicateMatch } from "./useQuestionDuplicateCheck";

describe("useQuestionDuplicateCheck", () => {
  let container: HTMLDivElement;
  let root: Root;
  let current: DuplicateMatch[];

  function Host({ text }: { text: string }): React.JSX.Element | null {
    current = useQuestionDuplicateCheck(text);
    return null;
  }

  const renderWith = (text: string) => {
    act(() => {
      root.render(<Host text={text} />);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    await act(async () => {
      root.unmount();
    });
    container.remove();
    checkSpy.mockReset();
  });

  it("debounces the lookup and reports ranked matches", async () => {
    checkSpy.mockResolvedValue({
      status: 200,
      body: {
        matches: [{ id: "q-1", text: "dup", difficulty: "easy", categoryIds: [], score: 1 }],
      },
    });
    renderWith("What is the capital of Egypt?");

    expect(checkSpy).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(checkSpy).toHaveBeenCalledTimes(1);
    expect(checkSpy.mock.calls[0][0].body.text).toBe("What is the capital of Egypt?");
    expect(current).toHaveLength(1);
  });

  it("aborts the in-flight request when the stem changes", async () => {
    let resolveFirst!: (value: { status: number; body: { matches: DuplicateMatch[] } }) => void;
    checkSpy
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue({
        status: 200,
        body: {
          matches: [{ id: "q-2", text: "b", difficulty: "easy", categoryIds: [], score: 1 }],
        },
      });
    renderWith("First question text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    const firstSignal = checkSpy.mock.calls[0][0].signal as AbortSignal | undefined;
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(false);

    renderWith("Second question text");
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // Only the second response lands; the first promise is never resolved.
    expect(current).toEqual([
      { id: "q-2", text: "b", difficulty: "easy", categoryIds: [], score: 1 },
    ]);
    resolveFirst({ status: 200, body: { matches: [] } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(current).toEqual([
      { id: "q-2", text: "b", difficulty: "easy", categoryIds: [], score: 1 },
    ]);
  });

  it("skips the lookup for non-comparable stems", async () => {
    renderWith("hi");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(checkSpy).not.toHaveBeenCalled();
    expect(current).toEqual([]);
  });
});
