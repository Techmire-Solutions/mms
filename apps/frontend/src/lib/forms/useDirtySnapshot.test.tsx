import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDirtySnapshot } from "./useDirtySnapshot";
import { useIdentityReset } from "./useIdentityReset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

interface Draft {
  name: string;
}

const EMPTY: Draft = { name: "" };

/**
 * Mirrors the canonical FormModal composition: reset-on-identity plus dirty tracking.
 * `useIdentityReset` schedules its reset during render, so the dirty baseline must be
 * told which value the reset will produce.
 */
function Harness({
  identity,
  initialDraft,
  onDirty,
}: {
  identity: string;
  initialDraft: Draft;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  useIdentityReset(identity, () => setDraft(initialDraft));
  const { isDirty } = useDirtySnapshot(draft, identity, initialDraft);
  onDirty(isDirty);
  return (
    <button type="button" onClick={() => setDraft((current) => ({ ...current, name: "typed" }))}>
      edit
    </button>
  );
}

describe("useDirtySnapshot", () => {
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

  it("is clean on edit-open and dirty only after an edit", async () => {
    const dirty: boolean[] = [];
    await act(async () => {
      root.render(
        <Harness
          identity="open:record-a"
          initialDraft={{ name: "Saved" }}
          onDirty={(value) => dirty.push(value)}
        />,
      );
    });
    // The reset render must not report the previous (empty) draft as dirty.
    expect(dirty.at(-1)).toBe(false);

    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(dirty.at(-1)).toBe(true);
  });

  it("re-baselines when the record identity changes", async () => {
    const dirty: boolean[] = [];
    const render = async (identity: string, initialDraft: Draft) => {
      await act(async () => {
        root.render(
          <Harness
            identity={identity}
            initialDraft={initialDraft}
            onDirty={(value) => dirty.push(value)}
          />,
        );
      });
    };
    await render("open:record-a", { name: "A" });
    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(dirty.at(-1)).toBe(true);

    await render("open:record-b", { name: "B" });
    expect(dirty.at(-1)).toBe(false);
  });

  it("stays clean while a refetch supplies an equal-value object", async () => {
    const dirty: boolean[] = [];
    const render = async (initialDraft: Draft) => {
      await act(async () => {
        root.render(
          <Harness
            identity="open:record-a"
            initialDraft={initialDraft}
            onDirty={(value) => dirty.push(value)}
          />,
        );
      });
    };
    await render({ name: "A" });
    await render({ name: "A" });
    expect(dirty.at(-1)).toBe(false);
  });
});
