import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeScope } from "./ThemeScope";
import { UiConfigProvider, useUiConfig } from "./UiConfigContext";

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
  it("injects custom CSS variables and sets data-theme", () => {
    const { container } = render(
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

    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeDefined();
    expect(root.className).toContain("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.getPropertyValue("--primary")).toBe("#d99b00");
    expect(root.style.getPropertyValue("--radius")).toBe("0.75rem");
  });

  it("provides localized labels via UiConfigProvider", () => {
    render(
      <UiConfigProvider config={{ dir: "rtl", labels: { cancel: "إلغاء" } }}>
        <TestConfigConsumer />
      </UiConfigProvider>,
    );

    expect(screen.getByTestId("cancel-label").textContent).toBe("إلغاء");
    expect(screen.getByTestId("dir-val").textContent).toBe("rtl");
  });
});
