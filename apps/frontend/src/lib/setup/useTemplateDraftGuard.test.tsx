import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useTemplateDraftGuard, type TemplateDraftGuard } from "./useTemplateDraftGuard";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let guard!: TemplateDraftGuard;

function Harness() {
  guard = useTemplateDraftGuard();
  return null;
}

describe("useTemplateDraftGuard", () => {
  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("tracks editor dirtiness", async () => {
    expect(guard.isDirty()).toBe(false);

    await act(async () => guard.markDirty(true));
    expect(guard.isDirty()).toBe(true);

    await act(async () => guard.markDirty(false));
    expect(guard.isDirty()).toBe(false);
  });

  it("clears the draft and remounts the editor on discard", async () => {
    await act(async () => guard.markDirty(true));
    const before = guard.resetNonce;

    await act(async () => guard.discard());

    expect(guard.isDirty()).toBe(false);
    expect(guard.resetNonce).toBe(before + 1);
  });
});
