import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdentityReset } from "./useIdentityReset";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness({
  identity,
  onReset,
  onValue,
}: {
  identity: string;
  onReset: () => void;
  onValue: (value: string) => void;
}) {
  const [value, setValue] = useState(identity);
  useIdentityReset(identity, () => {
    setValue(identity);
    onReset();
  });
  onValue(value);
  return null;
}

describe("useIdentityReset", () => {
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

  it("resets only when the identity changes, not on every render", async () => {
    const reset = vi.fn();
    let value = "";
    const render = async (identity: string) => {
      await act(async () => {
        root.render(
          <Harness
            identity={identity}
            onReset={reset}
            onValue={(next) => {
              value = next;
            }}
          />,
        );
      });
    };

    await render("open:new");
    // Mount hydrates once so a form opened on an existing record is never blank.
    expect(reset).toHaveBeenCalledTimes(1);
    expect(value).toBe("open:new");

    await render("open:1");
    expect(reset).toHaveBeenCalledTimes(2);
    expect(value).toBe("open:1");

    // Same identity (e.g. a refetch re-render) must not wipe the draft.
    await render("open:1");
    expect(reset).toHaveBeenCalledTimes(2);

    // Switching to create after editing resets again.
    await render("open:new");
    expect(reset).toHaveBeenCalledTimes(3);
    expect(value).toBe("open:new");
  });
});
