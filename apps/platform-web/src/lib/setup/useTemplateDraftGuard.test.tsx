import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import {
  useTemplateDraftGuard,
  type TemplateDraftGuard,
} from "@mms/fe-core/hooks/useTemplateDraftGuard";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const guardRef: { current?: TemplateDraftGuard } = {};

function Harness() {
  guardRef.current = useTemplateDraftGuard();
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
    expect(guardRef.current!.isDirty()).toBe(false);

    await act(async () => guardRef.current!.markDirty(true));
    expect(guardRef.current!.isDirty()).toBe(true);

    await act(async () => guardRef.current!.markDirty(false));
    expect(guardRef.current!.isDirty()).toBe(false);
  });

  it("clears the draft and remounts the editor on discard", async () => {
    await act(async () => guardRef.current!.markDirty(true));
    const before = guardRef.current!.resetNonce;

    await act(async () => guardRef.current!.discard());

    expect(guardRef.current!.isDirty()).toBe(false);
    expect(guardRef.current!.resetNonce).toBe(before + 1);
  });
});
