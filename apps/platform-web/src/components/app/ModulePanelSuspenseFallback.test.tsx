import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ModulePanelSuspenseFallback } from "@mms/fe-core/components/ModulePanelSuspenseFallback";
import { TranslationContext, type TranslationFunction } from "@mms/fe-core/i18n";

const mockContext = {
  language: "en",
  t: ((key: string) => key) as TranslationFunction,
  isLoading: false,
  dir: "ltr" as const,
  isRtl: false,
};

describe("ModulePanelSuspenseFallback", () => {
  it("renders accessible panel skeleton without spinning indicators", () => {
    const html = renderToStaticMarkup(
      <TranslationContext.Provider value={mockContext}>
        <ModulePanelSuspenseFallback />
      </TranslationContext.Provider>,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("animate-spin");
  });
});
