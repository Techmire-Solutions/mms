import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSubmitGuard } from "./useSubmitGuard";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Guard = ReturnType<typeof useSubmitGuard>;

function Harness({ onReady }: { onReady: (guard: Guard) => void }) {
  onReady(useSubmitGuard());
  return null;
}

describe("useSubmitGuard", () => {
  let container: HTMLDivElement;
  let root: Root;
  let guard: Guard | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function mount(): Promise<Guard> {
    await act(async () => {
      root.render(
        <Harness
          onReady={(current) => {
            guard = current;
          }}
        />,
      );
    });
    return guard!;
  }

  it("runs a task once while the first invocation is in flight", async () => {
    const submit = await mount();
    let release: (() => void) | undefined;
    const task = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve("done");
        }),
    );

    const first = submit(task);
    const second = submit(task);
    release?.();

    await expect(first).resolves.toBe("done");
    await expect(second).resolves.toBeUndefined();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("releases the guard after success and failure", async () => {
    const submit = await mount();
    await submit(async () => "ok");
    await expect(submit(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(submit(async () => "again")).resolves.toBe("again");
  });
});
