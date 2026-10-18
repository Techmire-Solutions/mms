import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { TooltipProvider } from "@shared/ui";
import { PlatformWorkspaceDensityToggle } from "./PlatformWorkspaceDensityToggle";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "dashboard.layoutDensity": "Data display density",
        "dashboard.densityCompact": "Compact (38px)",
        "dashboard.densityStandard": "Standard (48px)",
        "dashboard.densityComfortable": "Comfortable (64px)",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("PlatformWorkspaceDensityToggle", () => {
  it("renders all three density options with correct accessibility attributes", () => {
    const onDensityChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TooltipProvider>
          <PlatformWorkspaceDensityToggle density="standard" onDensityChange={onDensityChange} />
        </TooltipProvider>,
      );
    });

    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute("aria-label")).toBe("Data display density");

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(3);

    const [compactBtn, standardBtn, comfortableBtn] = Array.from(buttons);
    expect(compactBtn.getAttribute("aria-checked")).toBe("false");
    expect(standardBtn.getAttribute("aria-checked")).toBe("true");
    expect(comfortableBtn.getAttribute("aria-checked")).toBe("false");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("triggers onDensityChange when an option is clicked", () => {
    const onDensityChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TooltipProvider>
          <PlatformWorkspaceDensityToggle density="standard" onDensityChange={onDensityChange} />
        </TooltipProvider>,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const compactBtn = buttons[0];
    const comfortableBtn = buttons[2];

    act(() => {
      compactBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDensityChange).toHaveBeenCalledWith("compact");

    act(() => {
      comfortableBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDensityChange).toHaveBeenCalledWith("comfortable");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
