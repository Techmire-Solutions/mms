import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DensityToggle, type DensityMode } from "./DensityToggle";

const LABELS = {
  compact: "Compact",
  standard: "Standard",
  comfortable: "Comfortable",
} as const;

describe("DensityToggle Component", () => {
  it("renders a radiogroup with aria-label", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <DensityToggle
          density="standard"
          onChange={vi.fn()}
          ariaLabel="Row density"
          labels={LABELS}
        />
      </TooltipProvider>,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Row density"');
  });

  it.each(["compact", "standard", "comfortable"] as DensityMode[])(
    "renders %s as selected radio option",
    (activeDensity) => {
      const html = renderToStaticMarkup(
        <TooltipProvider>
          <DensityToggle
            density={activeDensity}
            onChange={vi.fn()}
            ariaLabel="Row density"
            labels={LABELS}
          />
        </TooltipProvider>,
      );

      expect(html).toContain(`aria-checked="true"`);
      expect(html).toContain(`aria-label="${LABELS[activeDensity]}"`);
    },
  );
});
