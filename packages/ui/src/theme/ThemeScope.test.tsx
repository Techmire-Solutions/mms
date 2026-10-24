import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ThemeScope } from "./ThemeScope";
import { UiConfigProvider, useUiConfig } from "./UiConfigContext";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function TestConfigConsumer() {
  const { labels, dir } = useUiConfig();
  return (
    <div>
      <span data-testid="cancel-label">{labels.cancel}</span>
      <span data-testid="dir-val">{dir}</span>
    </div>
  );
}

describe("ThemeScope & UiConfigContext", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("injects custom CSS variables and sets data-theme", async () => {
    await act(async () => {
      root.render(
        <ThemeScope
          theme={{
            primary: "#d99b00",
            secondary: "#5c3412",
            mode: "dark",
            radius: "0.75rem",
          }}
        >
          <div>Themed Content</div>
        </ThemeScope>,
      );
    });

    const themeRoot = container.firstElementChild as HTMLElement;
    expect(themeRoot).toBeDefined();
    expect(themeRoot.className).toContain("dark");
    expect(themeRoot.dataset.theme).toBe("dark");
    expect(themeRoot.style.getPropertyValue("--primary")).toBe("#d99b00");
    expect(themeRoot.style.getPropertyValue("--radius")).toBe("0.75rem");
  });

  it("provides localized labels via UiConfigProvider", async () => {
    await act(async () => {
      root.render(
        <UiConfigProvider config={{ dir: "rtl", labels: { cancel: "إلغاء" } }}>
          <TestConfigConsumer />
        </UiConfigProvider>,
      );
    });

    const cancelSpan = container.querySelector("[data-testid='cancel-label']");
    const dirSpan = container.querySelector("[data-testid='dir-val']");
    expect(cancelSpan?.textContent).toBe("إلغاء");
    expect(dirSpan?.textContent).toBe("rtl");
  });
});
