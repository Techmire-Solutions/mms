import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAvatarCropperCanvas } from "./useAvatarCropperCanvas";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Hook = ReturnType<typeof useAvatarCropperCanvas>;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 200;
  naturalHeight = 200;
  decoding = "async";
  private _src = "";

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (value.includes("bad")) this.onerror?.();
      else this.onload?.();
    });
  }
}

function Harness({ src, onReady }: { src: string; onReady: (hook: Hook) => void }) {
  const hook = useAvatarCropperCanvas(src);
  onReady(hook);
  return null;
}

describe("useAvatarCropperCanvas", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("Image", FakeImage);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("reports a load error instead of leaving the cropper blank", async () => {
    let hook!: Hook;
    await act(async () => {
      root.render(<Harness src="bad-image" onReady={(value) => (hook = value)} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(hook.loadError).toBe(true);
    expect(hook.isReady).toBe(false);
  });

  it("marks the cropper ready after a successful decode", async () => {
    let hook!: Hook;
    await act(async () => {
      root.render(<Harness src="good-image" onReady={(value) => (hook = value)} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(hook.loadError).toBe(false);
    expect(hook.isReady).toBe(true);
  });
});
