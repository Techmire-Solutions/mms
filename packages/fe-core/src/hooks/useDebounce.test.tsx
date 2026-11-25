import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./useDebounce";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useDebounce", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function Probe({ value, delay }: { value: string; delay: number }): React.JSX.Element {
    const debounced = useDebounce(value, delay);
    return <span data-value={debounced}>{debounced}</span>;
  }

  it("does not schedule a redundant timer on initial mount", async () => {
    await act(async () => {
      root.render(<Probe value="initial" delay={300} />);
    });

    expect(container.textContent).toBe("initial");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("debounces subsequent updates until the delay elapses", async () => {
    await act(async () => {
      root.render(<Probe value="initial" delay={300} />);
    });

    await act(async () => {
      root.render(<Probe value="next" delay={300} />);
    });

    expect(container.textContent).toBe("initial");
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(container.textContent).toBe("next");
    expect(vi.getTimerCount()).toBe(0);
  });
});
