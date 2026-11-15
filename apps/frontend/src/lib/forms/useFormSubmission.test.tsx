import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";
import { useFormSubmission, type UseFormSubmissionResult } from "./useFormSubmission";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Submission = UseFormSubmissionResult<{ name: string }>;

function Harness({
  save,
  onSuccess,
  onFieldErrors,
  conflictMessage,
  onReady,
}: {
  save: (data: { name: string }) => Promise<unknown>;
  onSuccess?: () => void | Promise<void>;
  onFieldErrors?: (errors: Record<string, string>) => void;
  conflictMessage?: string;
  onReady: (submission: Submission) => void;
}) {
  onReady(
    useFormSubmission({
      save,
      onSuccess,
      onFieldErrors,
      conflictMessage,
      fallbackMessage: "Could not save",
    }),
  );
  return null;
}

describe("useFormSubmission", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function mount(props: {
    save: (data: { name: string }) => Promise<unknown>;
    onSuccess?: () => void | Promise<void>;
    onFieldErrors?: (errors: Record<string, string>) => void;
    conflictMessage?: string;
  }): Promise<Submission> {
    let current: Submission | undefined;
    await act(async () => {
      root.render(<Harness {...props} onReady={(next) => (current = next)} />);
    });
    return {
      get submitting() {
        return current!.submitting;
      },
      get formError() {
        return current!.formError;
      },
      submit: (data) => current!.submit(data),
      clearFormError: () => current!.clearFormError(),
    };
  }

  it("awaits the save, runs onSuccess, and reports success", async () => {
    const save = vi.fn(async () => "saved");
    const onSuccess = vi.fn();
    const submission = await mount({ save, onSuccess });

    let result = false;
    await act(async () => {
      result = await submission.submit({ name: "A" });
    });

    expect(save).toHaveBeenCalledWith({ name: "A" });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(submission.submitting).toBe(false);
    expect(submission.formError).toBeNull();
  });

  it("maps API field errors and does not close", async () => {
    const onSuccess = vi.fn();
    const onFieldErrors = vi.fn();
    const save = vi.fn(async () => {
      throw new ApiError(422, "Validation failed", "validation", undefined, {
        name: "Name is required",
      });
    });
    const submission = await mount({ save, onSuccess, onFieldErrors });

    let result = true;
    await act(async () => {
      result = await submission.submit({ name: "" });
    });

    expect(result).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFieldErrors).toHaveBeenCalledWith({ name: "Name is required" });
    expect(submission.formError).toBe("Validation failed");
  });

  it("shows the fallback for a non-field failure", async () => {
    const submission = await mount({
      save: async () => {
        throw new Error("Network down");
      },
    });

    await act(async () => {
      await submission.submit({ name: "A" });
    });

    expect(submission.formError).toBe("Network down");
  });

  it("prefers conflict copy for a 409", async () => {
    const submission = await mount({
      save: async () => {
        throw new ApiError(409, "Stale token", "conflict");
      },
      conflictMessage: "Someone else changed this record",
    });

    await act(async () => {
      await submission.submit({ name: "A" });
    });

    expect(submission.formError).toBe("Someone else changed this record");
  });

  it("runs one save when submit is called twice in the same frame", async () => {
    let release: (() => void) | undefined;
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const submission = await mount({ save });

    let first = false;
    let second = true;
    await act(async () => {
      const firstPromise = submission.submit({ name: "A" });
      const secondPromise = submission.submit({ name: "A" });
      release?.();
      first = await firstPromise;
      second = await secondPromise;
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
