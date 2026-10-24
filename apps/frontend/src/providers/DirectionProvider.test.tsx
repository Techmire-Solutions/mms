import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach } from "vitest";
import { TranslationContext, type TranslationFunction } from "@/lib/contexts/TranslationContext";
import { vi } from "vitest";
import { DirectionProvider, useDirection } from "./DirectionProvider";

vi.mock("@/lib/localeFonts", () => ({
  ensureLocaleFontsLoaded: vi.fn(),
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockT: TranslationFunction = ((key: string) => key) as unknown as TranslationFunction;

let directionState: ReturnType<typeof useDirection> | null = null;

function Consumer(): React.JSX.Element {
  directionState = useDirection();
  return <div data-testid="consumer">{directionState.dir}</div>;
}

describe("DirectionProvider", () => {
  beforeEach(() => {
    directionState = null;
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
    document.documentElement.className = "";
  });

  it("sets LTR attributes and clean class names for English", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TranslationContext.Provider
          value={{
            language: "en",
            t: mockT,
            isLoading: false,
            dir: "ltr",
            isRtl: false,
          }}
        >
          <DirectionProvider>
            <Consumer />
          </DirectionProvider>
        </TranslationContext.Provider>,
      );
    });

    expect(directionState).toEqual({
      dir: "ltr",
      isRtl: false,
      language: "en",
    });
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.documentElement.classList.contains("font-arabic")).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("sets RTL attributes and font-arabic for Arabic", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TranslationContext.Provider
          value={{
            language: "ar",
            t: mockT,
            isLoading: false,
            dir: "rtl",
            isRtl: true,
          }}
        >
          <DirectionProvider>
            <Consumer />
          </DirectionProvider>
        </TranslationContext.Provider>,
      );
    });

    expect(directionState).toEqual({
      dir: "rtl",
      isRtl: true,
      language: "ar",
    });
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(document.documentElement.getAttribute("lang")).toBe("ar");
    expect(document.documentElement.classList.contains("font-arabic")).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("sets RTL attributes and font-urdu for Urdu", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TranslationContext.Provider
          value={{
            language: "ur",
            t: mockT,
            isLoading: false,
            dir: "rtl",
            isRtl: true,
          }}
        >
          <DirectionProvider>
            <Consumer />
          </DirectionProvider>
        </TranslationContext.Provider>,
      );
    });

    expect(directionState).toEqual({
      dir: "rtl",
      isRtl: true,
      language: "ur",
    });
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(document.documentElement.getAttribute("lang")).toBe("ur");
    expect(document.documentElement.classList.contains("font-urdu")).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("sets RTL attributes and font-persian for Persian", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TranslationContext.Provider
          value={{
            language: "fa",
            t: mockT,
            isLoading: false,
            dir: "rtl",
            isRtl: true,
          }}
        >
          <DirectionProvider>
            <Consumer />
          </DirectionProvider>
        </TranslationContext.Provider>,
      );
    });

    expect(directionState).toEqual({
      dir: "rtl",
      isRtl: true,
      language: "fa",
    });
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(document.documentElement.getAttribute("lang")).toBe("fa");
    expect(document.documentElement.classList.contains("font-persian")).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
