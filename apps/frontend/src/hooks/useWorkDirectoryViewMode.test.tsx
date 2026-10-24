import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useWorkDirectoryViewMode } from "./useWorkDirectoryViewMode";
import { MEDIA_MD_UP } from "@/lib/breakpoints";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("useWorkDirectoryViewMode Hook", () => {
  it('defaults to "table" when viewport is desktop (md+)', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === MEDIA_MD_UP,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    let result: ReturnType<typeof useWorkDirectoryViewMode> | undefined;
    const TestComponent = () => {
      result = useWorkDirectoryViewMode();
      return <div>{result.viewMode}</div>;
    };

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(result?.viewMode).toBe("table");
    expect(container.textContent).toBe("table");

    await act(async () => {
      root.unmount();
    });
  });

  it('defaults to "cards" when viewport is mobile (< md)', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    let result: ReturnType<typeof useWorkDirectoryViewMode> | undefined;
    const TestComponent = () => {
      result = useWorkDirectoryViewMode();
      return <div>{result.viewMode}</div>;
    };

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(result?.viewMode).toBe("cards");
    expect(container.textContent).toBe("cards");

    await act(async () => {
      root.unmount();
    });
  });

  it("honors manual setViewMode override over media query default", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === MEDIA_MD_UP,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    let result: ReturnType<typeof useWorkDirectoryViewMode> | undefined;
    const TestComponent = () => {
      result = useWorkDirectoryViewMode();
      return (
        <button type="button" onClick={() => result?.setViewMode("cards")}>
          {result.viewMode}
        </button>
      );
    };

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<TestComponent />);
    });

    expect(result?.viewMode).toBe("table");

    await act(async () => {
      container.querySelector("button")?.click();
    });

    expect(result?.viewMode).toBe("cards");
    expect(container.textContent).toBe("cards");

    await act(async () => {
      root.unmount();
    });
  });
});
